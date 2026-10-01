package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.PatientProfileResponse;
import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.AppointmentService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientClient patientClient;
    private final DoctorClient doctorClient;

    @Override
    @Transactional
    public AppointmentResponse create(UUID currentUserId, String authorizationHeader, CreateAppointmentRequest request) {
        log.info("User {} is creating appointment with doctor {} on {}", currentUserId, request.doctorId(), request.appointmentDate());

        validateTimeRange(request);
        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
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
                .doctorId(request.doctorId())
                .appointmentDate(request.appointmentDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .status(AppointmentStatus.PENDING)
                .reason(request.reason())
                .build();

        appointment = appointmentRepository.save(appointment);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AppointmentResponse> getMyAppointments(UUID currentUserId, String authorizationHeader) {
        log.info("Fetching appointments for user {}", currentUserId);
        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
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

        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST") || principal.hasRole("DOCTOR")) {
            return mapToResponse(appointment);
        }

        if (principal.hasRole("PATIENT")) {
            PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
            if (appointment.getPatientId().equals(patientProfile.id())) {
                return mapToResponse(appointment);
            }
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view this appointment");
    }

    @Override
    @Transactional
    public AppointmentResponse cancel(UUID currentUserId, String authorizationHeader, UUID appointmentId) {
        log.info("User {} cancelling appointment {}", currentUserId, appointmentId);
        Appointment appointment = getAppointmentById(appointmentId);
        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);

        if (!appointment.getPatientId().equals(patientProfile.id())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to cancel this appointment");
        }

        if (appointment.getStatus() == AppointmentStatus.COMPLETED || appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot cancel a completed or already cancelled appointment");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment = appointmentRepository.save(appointment);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional
    public AppointmentResponse confirm(UUID currentUserId, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Confirming appointment {}", appointmentId);

        if (!principal.hasRole("RECEPTIONIST") && !principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to confirm appointments");
        }

        Appointment appointment = getAppointmentById(appointmentId);

        if (appointment.getStatus() != AppointmentStatus.PENDING) {
             throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Can only confirm pending appointments");
        }

        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment = appointmentRepository.save(appointment);

        return mapToResponse(appointment);
    }

    @Override
    @Transactional
    public AppointmentResponse complete(UUID currentUserId, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Completing appointment {}", appointmentId);

        if (!principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can complete appointments");
        }

        Appointment appointment = getAppointmentById(appointmentId);

        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
             throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Can only complete confirmed appointments");
        }

        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointment = appointmentRepository.save(appointment);

        return mapToResponse(appointment);
    }

    private Appointment getAppointmentById(UUID appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
    }

    private void validateTimeRange(CreateAppointmentRequest request) {
        if (!request.startTime().isBefore(request.endTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Start time must be before end time");
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
