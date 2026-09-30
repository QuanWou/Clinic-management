package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.PatientProfileResponse;
import com.clinic.appointment.client.RecipientDirectoryClient;
import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.AppointmentAvailabilityResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.AppointmentNotificationOutbox;
import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.AppointmentService;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientClient patientClient;
    private final DoctorClient doctorClient;
    private final ReceptionVisitRepository receptionVisitRepository;
    private final ReceptionQueueService receptionQueueService;
    private final AppointmentNotificationOutboxRepository notificationOutbox;
    private final RecipientDirectoryClient recipients;

    @Override
    @Transactional
    public AppointmentResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateAppointmentRequest request) {
        log.info("User {} is creating appointment with doctor {} on {}", currentUserId, request.doctorId(), request.appointmentDate());

        requirePatient(principal);
        validateTimeRange(request.appointmentDate(), request.startTime(), request.endTime());
        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
        requireMatchingPatient(currentUserId, patientProfile);
        UUID patientId = patientProfile.id();

        DoctorAvailabilityResponse availability = doctorClient.getAvailability(
                authorizationHeader,
                request.doctorId(),
                request.appointmentDate().getDayOfWeek().getValue(),
                request.startTime(),
                request.endTime()
        );

        if (!availability.available()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Doctor is not available at the requested time slot based on schedule");
        }

        boolean overlap = appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                request.doctorId(),
                request.appointmentDate(),
                request.endTime(),
                request.startTime(),
                AppointmentStatus.CANCELLED
        );

        if (overlap) {
            throw new BusinessException(ErrorCode.CONFLICT, "Doctor is not available at the requested time slot");
        }

        Appointment appointment = Appointment.builder()
                .patientId(patientId)
                .patientUserId(currentUserId)
                .doctorId(request.doctorId())
                .appointmentDate(request.appointmentDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .status(AppointmentStatus.PENDING)
                .reason(request.reason())
                .build();

        try {
            // Flush now so a concurrent PostgreSQL exclusion violation maps to HTTP 409.
            appointment = appointmentRepository.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException ex) {
            if (isOverlappingSlot(ex)) {
                throw new BusinessException(ErrorCode.CONFLICT, "Doctor is not available at the requested time slot");
            }
            throw ex;
        }

        recordNotification("APPOINTMENT_CREATED", appointment, currentUserId);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentAvailabilityResponse getAvailability(String authorizationHeader, UUID doctorId,
                                                            LocalDate date, LocalTime startTime, LocalTime endTime) {
        validateTimeRange(date, startTime, endTime);
        DoctorAvailabilityResponse schedule = doctorClient.getAvailability(authorizationHeader, doctorId,
                date.getDayOfWeek().getValue(), startTime, endTime);
        boolean open = schedule.available() && !appointmentRepository
                .existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                        doctorId, date, endTime, startTime, AppointmentStatus.CANCELLED);
        return new AppointmentAvailabilityResponse(doctorId, date, startTime, endTime, open);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppointmentResponse> getMyAppointments(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal) {
        log.info("Fetching appointments for user {}", currentUserId);
        requirePatient(principal);
        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
        requireMatchingPatient(currentUserId, patientProfile);
        return appointmentRepository.findByPatientIdOrderByAppointmentDateDescStartTimeDesc(patientProfile.id())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Fetching appointment {} for user {}", appointmentId, currentUserId);
        Appointment appointment = getAppointmentById(appointmentId);

        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST")) {
            return mapToResponse(appointment);
        }

        if (principal.hasRole("PATIENT")) {
            PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
            requireMatchingPatient(currentUserId, patientProfile);
            if (appointment.getPatientId().equals(patientProfile.id())) {
                return mapToResponse(appointment);
            }
        }

        if (principal.hasRole("DOCTOR")) {
            requireAssignedDoctor(principal, authorizationHeader, appointment);
            return mapToResponse(appointment);
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view this appointment");
    }

    @Override
    @Transactional
    public AppointmentResponse cancel(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("User {} cancelling appointment {}", currentUserId, appointmentId);
        if (!principal.hasRole("PATIENT") && !principal.hasRole("RECEPTIONIST") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to cancel appointments");
        }
        Appointment appointment = getAppointmentByIdForUpdate(appointmentId);

        if (!principal.hasRole("RECEPTIONIST") && !principal.hasRole("ADMIN")) {
            PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
            requireMatchingPatient(currentUserId, patientProfile);
            if (!appointment.getPatientId().equals(patientProfile.id())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to cancel this appointment");
            }
        }

        if (appointment.getStatus() == AppointmentStatus.COMPLETED || appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cannot cancel a completed or already cancelled appointment");
        }

        // All writers lock the appointment before inspecting/locking its visit. Check-in
        // takes the same appointment lock, so a concurrent check-in cannot slip between
        // this check and the cancellation commit.
        if (receptionVisitRepository.findByAppointmentId(appointmentId).isPresent()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cannot cancel an appointment after check-in");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment = appointmentRepository.save(appointment);
        recordNotification("APPOINTMENT_CANCELLED", appointment,
                principal.hasRole("PATIENT") ? currentUserId : null);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional
    public AppointmentResponse confirm(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Confirming appointment {}", appointmentId);

        if (!principal.hasRole("RECEPTIONIST") && !principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to confirm appointments");
        }

        Appointment appointment = getAppointmentByIdForUpdate(appointmentId);
        if (!principal.hasRole("RECEPTIONIST") && !principal.hasRole("ADMIN")) {
            requireAssignedDoctor(principal, authorizationHeader, appointment);
        }

        if (appointment.getStatus() != AppointmentStatus.PENDING) {
             throw new BusinessException(ErrorCode.CONFLICT, "Can only confirm pending appointments");
        }

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment = appointmentRepository.save(appointment);
        recordNotification("APPOINTMENT_CONFIRMED", appointment, null);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional
    public AppointmentResponse complete(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Completing appointment {}", appointmentId);

        if (!principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can complete appointments");
        }

        Appointment appointment = getAppointmentByIdForUpdate(appointmentId);
        if (!principal.hasRole("ADMIN")) {
            requireAssignedDoctor(principal, authorizationHeader, appointment);
        }

        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
             throw new BusinessException(ErrorCode.CONFLICT, "Can only complete confirmed appointments");
        }

        // The queue service holds the same transaction and lock order (appointment,
        // then visit). It atomically finishes both records, or rejects an invalid
        // WAITING/CALLED transition; do not independently complete a checked-in booking.
        if (receptionQueueService.completeCheckedInAppointment(appointmentId, principal, authorizationHeader)) {
            return mapToResponse(appointment);
        }

        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointment = appointmentRepository.save(appointment);

        return mapToResponse(appointment);
    }

    private Appointment getAppointmentById(UUID appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
    }

    private Appointment getAppointmentByIdForUpdate(UUID appointmentId) {
        return appointmentRepository.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
    }

    private void requirePatient(CurrentUserPrincipal principal) {
        if (!principal.hasRole("PATIENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only patients can book appointments");
        }
    }

    private void requireMatchingPatient(UUID userId, PatientProfileResponse patientProfile) {
        if (patientProfile.id() == null || !userId.equals(patientProfile.userId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Patient profile does not belong to the authenticated user");
        }
    }

    private void requireAssignedDoctor(CurrentUserPrincipal principal, String authorizationHeader, Appointment appointment) {
        if (!principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Doctor role required");
        }
        var doctor = doctorClient.getCurrentDoctorProfile(authorizationHeader);
        if (!principal.id().equals(doctor.userId()) || !appointment.getDoctorId().equals(doctor.id())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the assigned doctor can access this appointment");
        }
    }

    private boolean isOverlappingSlot(Throwable ex) {
        while (ex != null) {
            if (ex instanceof SQLException sql && "23P01".equals(sql.getSQLState())) {
                return true;
            }
            ex = ex.getCause();
        }
        return false;
    }

    private void recordNotification(String eventType, Appointment appointment, UUID knownRecipient) {
        UUID recipient = knownRecipient != null ? knownRecipient : appointment.getPatientUserId();
        if (recipient == null) {
            try {
                recipient = recipients.resolve(appointment.getPatientId());
                appointment.setPatientUserId(recipient);
            } catch (BusinessException ex) {
                log.warn("Skipping {} notification for appointment {} without linked identity", eventType, appointment.getId());
                return;
            }
        }
        notificationOutbox.save(new AppointmentNotificationOutbox(eventType, appointment.getId(), recipient));
    }

    private void validateTimeRange(LocalDate date, LocalTime startTime, LocalTime endTime) {
        if (date == null || startTime == null || endTime == null || !startTime.isBefore(endTime)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Start time must be before end time");
        }
        if (!LocalDateTime.of(date, startTime).isAfter(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Appointment must start in the future");
        }
    }

    private AppointmentResponse mapToResponse(Appointment appointment) {
        return new AppointmentResponse(
                appointment.getId(),
                appointment.getPatientId(),
                appointment.getDoctorId(),
                appointment.getAppointmentDate(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getStatus(),
                appointment.getReason(),
                appointment.getCreatedAt(),
                appointment.getUpdatedAt()
        );
    }
}
