package com.clinic.appointment.service;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.RecipientDirectoryClient;
import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateReceptionAppointmentRequest;
import com.clinic.appointment.dto.RescheduleReceptionAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.AppointmentNotificationOutbox;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import com.clinic.appointment.repository.ReceptionAppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReceptionSchedulingService {
    private static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AppointmentRepository appointments;
    private final ReceptionAppointmentRepository receptionAppointments;
    private final ReceptionVisitRepository visits;
    private final PatientClient patientClient;
    private final DoctorClient doctorClient;
    private final BookingDayLock bookingLock;
    private final AppointmentNotificationOutboxRepository notificationOutbox;
    private final RecipientDirectoryClient recipients;

    @Transactional
    public AppointmentResponse book(String authorization, CreateReceptionAppointmentRequest request) {
        validateSlot(request.appointmentDate(), request.startTime(), request.endTime());
        var patient = patientClient.getPatientForReception(authorization, request.patientId());
        ensureDoctorAvailable(authorization, request.doctorId(), request.appointmentDate(),
                request.startTime(), request.endTime());
        bookingLock.lock(request.doctorId(), request.appointmentDate());
        validateSlot(request.appointmentDate(), request.startTime(), request.endTime());
        ensureNoOverlap(request.doctorId(), request.appointmentDate(), request.startTime(), request.endTime(), null);
        Appointment created = saveWithOverlapMapping(Appointment.builder()
                .patientId(request.patientId())
                .patientUserId(patient.userId())
                .doctorId(request.doctorId())
                .appointmentDate(request.appointmentDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .reason(request.reason().trim())
                .status(AppointmentStatus.PENDING)
                .build());
        recordNotification("APPOINTMENT_CREATED", created);
        log.info("Reception booked appointment {} for patient {}", created.getId(), created.getPatientId());
        return toResponse(created);
    }

    @Transactional
    public AppointmentResponse reschedule(String authorization, UUID appointmentId,
                                          RescheduleReceptionAppointmentRequest request) {
        validateSlot(request.appointmentDate(), request.startTime(), request.endTime());
        Appointment appointment = lockedAppointment(appointmentId);
        validateMutable(appointment);
        ensureDoctorAvailable(authorization, request.doctorId(), request.appointmentDate(),
                request.startTime(), request.endTime());
        bookingLock.lock(request.doctorId(), request.appointmentDate());
        validateSlot(request.appointmentDate(), request.startTime(), request.endTime());
        ensureNoOverlap(request.doctorId(), request.appointmentDate(), request.startTime(), request.endTime(), appointmentId);
        appointment.setDoctorId(request.doctorId());
        appointment.setAppointmentDate(request.appointmentDate());
        appointment.setStartTime(request.startTime());
        appointment.setEndTime(request.endTime());
        appointment.setStatus(AppointmentStatus.PENDING);
        Appointment updated = saveWithOverlapMapping(appointment);
        recordNotification("APPOINTMENT_RESCHEDULED", updated);
        log.info("Reception rescheduled appointment {}", appointmentId);
        return toResponse(updated);
    }

    @Transactional
    public AppointmentResponse cancel(UUID appointmentId) {
        Appointment appointment = lockedAppointment(appointmentId);
        validateMutable(appointment);
        appointment.setStatus(AppointmentStatus.CANCELLED);
        Appointment updated = appointments.saveAndFlush(appointment);
        recordNotification("APPOINTMENT_CANCELLED", updated);
        log.info("Reception cancelled appointment {}", appointmentId);
        return toResponse(updated);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> list(LocalDate date, UUID doctorId) {
        LocalDate target = date == null ? LocalDate.now(CLINIC_ZONE) : date;
        List<Appointment> result = doctorId == null
                ? receptionAppointments.findByAppointmentDateOrderByStartTimeAsc(target)
                : receptionAppointments.findByDoctorIdAndAppointmentDateOrderByStartTimeAsc(doctorId, target);
        return result.stream().map(this::toResponse).toList();
    }

    private Appointment lockedAppointment(UUID appointmentId) {
        return receptionAppointments.lockById(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
    }

    private void validateMutable(Appointment appointment) {
        if (appointment.getStatus() == AppointmentStatus.COMPLETED
                || appointment.getStatus() == AppointmentStatus.CANCELLED
                || visits.findByAppointmentId(appointment.getId()).isPresent()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Appointment cannot be changed after check-in, completion or cancellation");
        }
    }

    private void validateSlot(LocalDate date, LocalTime start, LocalTime end) {
        LocalDateTime now = LocalDateTime.now(CLINIC_ZONE);
        if (date == null || start == null || end == null || !start.isBefore(end)
                || !LocalDateTime.of(date, start).isAfter(now)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid appointment date or time range");
        }
    }

    private void ensureDoctorAvailable(String authorization, UUID doctorId, LocalDate date, LocalTime start, LocalTime end) {
        DoctorAvailabilityResponse available = doctorClient.getAvailability(authorization, doctorId,
                date.getDayOfWeek().getValue(), start, end);
        if (!available.available()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Doctor unavailable at requested time");
        }
    }

    private void ensureNoOverlap(UUID doctorId, LocalDate date, LocalTime start, LocalTime end, UUID excludeId) {
        boolean hasOverlap = excludeId == null
                ? receptionAppointments.hasOverlap(doctorId, date, start, end, AppointmentStatus.CANCELLED)
                : receptionAppointments.hasOverlapExcluding(doctorId, date, start, end, AppointmentStatus.CANCELLED, excludeId);
        if (hasOverlap) {
            throw new BusinessException(ErrorCode.CONFLICT, "Doctor has an overlapping appointment");
        }
    }

    private Appointment saveWithOverlapMapping(Appointment appointment) {
        try {
            // The Task 01 PostgreSQL exclusion constraint is authoritative across patient and staff flows.
            return appointments.saveAndFlush(appointment);
        } catch (DataIntegrityViolationException ex) {
            for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
                if (cause instanceof SQLException sql && "23P01".equals(sql.getSQLState())) {
                    throw new BusinessException(ErrorCode.CONFLICT, "Doctor has an overlapping appointment");
                }
            }
            throw ex;
        }
    }

    private AppointmentResponse toResponse(Appointment a) {
        return new AppointmentResponse(a.getId(), a.getPatientId(), a.getDoctorId(), a.getAppointmentDate(),
                a.getStartTime(), a.getEndTime(), a.getStatus(), a.getReason(), a.getCreatedAt(), a.getUpdatedAt());
    }

    private void recordNotification(String eventType, Appointment appointment) {
        UUID recipient = appointment.getPatientUserId();
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
}
