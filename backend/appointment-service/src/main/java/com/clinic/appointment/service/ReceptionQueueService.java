package com.clinic.appointment.service;

import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.InternalPatientSummaryResponse;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.dto.EncounterContextResponse;
import com.clinic.appointment.dto.ReceptionHistoryResponse;
import com.clinic.appointment.dto.ReceptionVisitResponse;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.QueueStatus;
import com.clinic.appointment.entity.ReceptionVisit;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.ReceptionAppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReceptionQueueService {
    private static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ReceptionAppointmentRepository appointmentRepository;
    private final AppointmentRepository appointments;
    private final ReceptionVisitRepository visitRepository;
    private final QueueDayLock dayLock;
    private final DoctorClient doctorClient;
    private final PatientClient patientClient;

    @Transactional
    public ReceptionVisitResponse checkIn(UUID appointmentId) {
        Appointment appointment = appointmentRepository.lockById(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
        ReceptionVisit existing = visitRepository.findByAppointmentId(appointmentId).orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }
        LocalDate today = LocalDate.now(CLINIC_ZONE);
        if (!appointment.getAppointmentDate().equals(today)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Check-in is only available on the appointment date");
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only confirmed appointments can be checked in");
        }

        dayLock.lock(appointment.getDoctorId(), today);
        int nextNumber = visitRepository.lastQueueNumber(appointment.getDoctorId(), today) + 1;
        ReceptionVisit visit = ReceptionVisit.builder()
                .appointmentId(appointment.getId())
                .patientId(appointment.getPatientId())
                .doctorId(appointment.getDoctorId())
                .visitDate(today)
                .queueNumber(nextNumber)
                .status(QueueStatus.WAITING)
                .checkedInAt(LocalDateTime.now(CLINIC_ZONE))
                .build();
        ReceptionVisit created = visitRepository.saveAndFlush(visit);
        log.info("Checked in appointment {} with queue number {} for doctor {}", appointmentId, nextNumber,
                appointment.getDoctorId());
        return toResponse(created);
    }

    @Transactional(readOnly = true)
    public List<ReceptionVisitResponse> list(LocalDate date, UUID doctorId,
                                             CurrentUserPrincipal principal, String authorization) {
        LocalDate visitDate = date == null ? LocalDate.now(CLINIC_ZONE) : date;
        UUID allowedDoctorId = ownedDoctorId(principal, authorization);
        if (allowedDoctorId != null) {
            if (doctorId != null && !doctorId.equals(allowedDoctorId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Cannot view another doctor's queue");
            }
            doctorId = allowedDoctorId;
        }
        List<ReceptionVisit> visits = doctorId == null
                ? visitRepository.findByVisitDateOrderByDoctorIdAscQueueNumberAsc(visitDate)
                : visitRepository.findByDoctorIdAndVisitDateOrderByQueueNumberAsc(doctorId, visitDate);
        if (visits.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> patientNames = patientClient.getInternalSummaries(
                        visits.stream().map(ReceptionVisit::getPatientId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(InternalPatientSummaryResponse::patientId,
                        InternalPatientSummaryResponse::fullName));
        return visits.stream().map(visit -> toResponse(visit, patientNames.get(visit.getPatientId()))).toList();
    }

    @Transactional(readOnly = true)
    public EncounterContextResponse getEncounterContext(UUID appointmentId, CurrentUserPrincipal principal,
                                                        String authorization) {
        if (principal == null || (!principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Doctor or administrator role required");
        }
        ReceptionVisit visit = visitRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Checked-in visit not found"));
        Appointment appointment = appointments.findById(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
        if (!visit.getAppointmentId().equals(appointment.getId())
                || !visit.getDoctorId().equals(appointment.getDoctorId())
                || !visit.getPatientId().equals(appointment.getPatientId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Visit and appointment do not match");
        }
        UUID allowedDoctorId = ownedDoctorId(principal, authorization);
        if (allowedDoctorId != null && !visit.getDoctorId().equals(allowedDoctorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cannot open another doctor's encounter");
        }

        InternalPatientSummaryResponse patient = patientClient.getInternalSummary(visit.getPatientId());
        return new EncounterContextResponse(
                visit.getId(),
                appointment.getId(),
                appointment.getPatientId(),
                appointment.getDoctorId(),
                visit.getQueueNumber(),
                visit.getStatus(),
                appointment.getAppointmentDate(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getReason(),
                new EncounterContextResponse.PatientSummary(
                        patient.patientId(),
                        patient.fullName(),
                        patient.dob(),
                        patient.gender(),
                        patient.bloodType())
        );
    }

    @Transactional(readOnly = true)
    public ReceptionHistoryResponse history(LocalDate from, LocalDate to,
                                            CurrentUserPrincipal principal, String authorization) {
        if (from == null || to == null || from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > 30) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "History range must contain 1 to 31 days");
        }
        if (principal == null || (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")
                && !principal.hasRole("DOCTOR"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Staff role required");
        }
        UUID doctorId = ownedDoctorId(principal, authorization);
        var appointmentRows = doctorId == null
                ? appointmentRepository.findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(from, to)
                : List.<Appointment>of();
        var visitRows = doctorId == null
                ? visitRepository.findByVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(from, to)
                : visitRepository.findByDoctorIdAndVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(doctorId, from, to);

        Map<LocalDate, List<Appointment>> byAppointmentDay = appointmentRows.stream()
                .collect(Collectors.groupingBy(Appointment::getAppointmentDate));
        Map<LocalDate, List<ReceptionVisit>> byVisitDay = visitRows.stream()
                .collect(Collectors.groupingBy(ReceptionVisit::getVisitDate));
        List<ReceptionHistoryResponse.Day> days = from.datesUntil(to.plusDays(1)).map(day -> {
            var appointmentsOnDay = byAppointmentDay.getOrDefault(day, List.of());
            var visitsOnDay = byVisitDay.getOrDefault(day, List.of());
            return new ReceptionHistoryResponse.Day(day, appointmentsOnDay.size(), visitsOnDay.size(),
                    visitsOnDay.stream().filter(v -> v.getStatus() == QueueStatus.COMPLETED).count(),
                    appointmentsOnDay.stream().filter(a -> a.getStatus() == AppointmentStatus.CANCELLED).count());
        }).toList();
        return new ReceptionHistoryResponse(from, to, doctorId == null ? "RECEPTION" : "DOCTOR", days);
    }

    @Transactional
    public boolean completeCheckedInAppointment(UUID appointmentId, CurrentUserPrincipal principal,
                                                String authorization) {
        return visitRepository.findByAppointmentId(appointmentId)
                .map(visit -> {
                    changeStatus(visit.getId(), QueueStatus.COMPLETED, principal, authorization);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public ReceptionVisitResponse changeStatus(UUID visitId, QueueStatus target,
                                               CurrentUserPrincipal principal, String authorization) {
        ReceptionVisit identified = visitRepository.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Visit not found"));
        Appointment appointment = appointmentRepository.lockById(identified.getAppointmentId())
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
        ReceptionVisit visit = visitRepository.lockById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Visit not found"));
        if (!visit.getAppointmentId().equals(appointment.getId())
                || !visit.getDoctorId().equals(appointment.getDoctorId())
                || !visit.getPatientId().equals(appointment.getPatientId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Visit and appointment do not match");
        }
        UUID allowedDoctorId = ownedDoctorId(principal, authorization);
        if (allowedDoctorId != null && !visit.getDoctorId().equals(allowedDoctorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cannot change another doctor's queue");
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Appointment must be confirmed to change its queue status");
        }
        QueueStatus current = visit.getStatus();
        if (target == null || !canTransition(current, target)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invalid queue status transition");
        }
        if ((target == QueueStatus.IN_PROGRESS || target == QueueStatus.COMPLETED)
                && !principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only an assigned doctor or administrator can start or finish a visit");
        }
        visit.setStatus(target);
        if (target == QueueStatus.IN_PROGRESS) {
            visit.setStartedAt(LocalDateTime.now(CLINIC_ZONE));
        }
        if (target == QueueStatus.COMPLETED) {
            visit.setCompletedAt(LocalDateTime.now(CLINIC_ZONE));
            appointment.setStatus(AppointmentStatus.COMPLETED);
            appointments.saveAndFlush(appointment);
        }
        log.info("Visit {} moved from {} to {}", visitId, current, target);
        return toResponse(visitRepository.saveAndFlush(visit));
    }

    private UUID ownedDoctorId(CurrentUserPrincipal principal, String authorization) {
        if (principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            var doctor = doctorClient.getCurrentDoctorProfile(authorization);
            if (!principal.id().equals(doctor.userId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Doctor profile does not belong to the authenticated user");
            }
            return doctor.id();
        }
        return null;
    }

    private boolean canTransition(QueueStatus current, QueueStatus target) {
        return switch (current) {
            case WAITING -> target == QueueStatus.CALLED || target == QueueStatus.SKIPPED;
            case CALLED -> target == QueueStatus.IN_PROGRESS || target == QueueStatus.SKIPPED;
            case SKIPPED -> target == QueueStatus.WAITING;
            case IN_PROGRESS -> target == QueueStatus.COMPLETED;
            case COMPLETED -> false;
        };
    }

    private ReceptionVisitResponse toResponse(ReceptionVisit visit) {
        return toResponse(visit, null);
    }

    private ReceptionVisitResponse toResponse(ReceptionVisit visit, String patientName) {
        return new ReceptionVisitResponse(visit.getId(), visit.getAppointmentId(), visit.getPatientId(),
                patientName, visit.getDoctorId(), visit.getVisitDate(), visit.getQueueNumber(), visit.getStatus(),
                visit.getCheckedInAt(), visit.getStartedAt(), visit.getCompletedAt());
    }
}
