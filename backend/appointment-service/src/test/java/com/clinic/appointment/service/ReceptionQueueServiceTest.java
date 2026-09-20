package com.clinic.appointment.service;

import com.clinic.appointment.client.DoctorProfileResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.QueueStatus;
import com.clinic.appointment.entity.ReceptionVisit;
import com.clinic.appointment.repository.ReceptionAppointmentRepository;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceptionQueueServiceTest {
    @Mock ReceptionAppointmentRepository appointments;
    @Mock AppointmentRepository appointmentWrites;
    @Mock ReceptionVisitRepository visits;
    @Mock QueueDayLock dayLock;
    @Mock DoctorClient doctorClient;
    @InjectMocks ReceptionQueueService service;

    private UUID appointmentId;
    private UUID doctorId;
    private Appointment appointment;
    private LocalDate today;

    @BeforeEach
    void setup() {
        appointmentId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        appointment = Appointment.builder().id(appointmentId).patientId(UUID.randomUUID())
                .doctorId(doctorId).appointmentDate(today).startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0)).status(AppointmentStatus.CONFIRMED).build();
    }

    @Test
    void receptionistHistoryReturnsOnlyThirtyDayAggregatesWithEmptyWeekendDays() {
        LocalDate from = LocalDate.of(2026, 8, 22);
        LocalDate to = LocalDate.of(2026, 9, 20);
        Appointment synthetic = Appointment.builder().id(UUID.randomUUID()).doctorId(doctorId)
                .patientId(UUID.randomUUID()).appointmentDate(LocalDate.of(2026, 9, 18))
                .status(AppointmentStatus.COMPLETED).build();
        ReceptionVisit visit = ReceptionVisit.builder().id(UUID.randomUUID()).appointmentId(synthetic.getId())
                .doctorId(doctorId).patientId(synthetic.getPatientId())
                .visitDate(synthetic.getAppointmentDate()).status(QueueStatus.COMPLETED).build();
        when(appointments.findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(from, to))
                .thenReturn(List.of(synthetic));
        when(visits.findByVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(from, to))
                .thenReturn(List.of(visit));
        var principal = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.local", "Reception",
                Set.of("ROLE_RECEPTIONIST"));

        var report = service.history(from, to, principal, "Bearer test");

        assertEquals("RECEPTION", report.scope());
        assertEquals(30, report.days().size());
        assertEquals(1, report.days().get(27).appointments());
        assertEquals(1, report.days().get(27).checkIns());
        assertEquals(1, report.days().get(27).completedVisits());
        assertEquals(0, report.days().get(29).appointments());
        verifyNoInteractions(doctorClient);
    }

    @Test
    void doctorHistoryNeverQueriesClinicWideAppointmentsOrVisits() {
        LocalDate from = LocalDate.of(2026, 8, 22);
        LocalDate to = LocalDate.of(2026, 9, 20);
        var principal = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local", "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("Bearer doctor"))
                .thenReturn(new DoctorProfileResponse(doctorId, principal.id()));
        when(visits.findByDoctorIdAndVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(doctorId, from, to))
                .thenReturn(List.of(ReceptionVisit.builder().visitDate(LocalDate.of(2026, 9, 18))
                        .status(QueueStatus.COMPLETED).build()));

        var report = service.history(from, to, principal, "Bearer doctor");

        assertEquals("DOCTOR", report.scope());
        assertEquals(1, report.days().get(27).checkIns());
        assertEquals(0, report.days().get(27).appointments());
        verify(appointments, never()).findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(any(), any());
        verify(visits, never()).findByVisitDateBetweenOrderByVisitDateAscQueueNumberAsc(any(), any());
    }

    @Test
    void historyRejectsUnboundedRangesBeforeAnyQueries() {
        var receptionist = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.local", "Reception",
                Set.of("ROLE_RECEPTIONIST"));
        assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                () -> service.history(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 9, 20),
                        receptionist, "Bearer test")).getErrorCode());
        verifyNoInteractions(appointments, visits, doctorClient);
    }

    @Test
    void firstCheckInAllocatesNumberAfterDoctorDayLock() {
        when(appointments.lockById(appointmentId)).thenReturn(Optional.of(appointment));
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.empty());
        when(visits.lastQueueNumber(doctorId, today)).thenReturn(7);
        when(visits.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));

        var result = service.checkIn(appointmentId);

        assertEquals(8, result.queueNumber());
        assertEquals(QueueStatus.WAITING, result.status());
        var order = inOrder(appointments, dayLock, visits);
        order.verify(appointments).lockById(appointmentId);
        order.verify(visits).findByAppointmentId(appointmentId);
        order.verify(dayLock).lock(doctorId, today);
        order.verify(visits).lastQueueNumber(doctorId, today);
        order.verify(visits).saveAndFlush(any());
    }

    @Test
    void repeatedCheckInReturnsSameTicketWithoutIncrement() {
        ReceptionVisit previous = ReceptionVisit.builder().appointmentId(appointmentId)
                .doctorId(doctorId).patientId(appointment.getPatientId()).visitDate(today)
                .queueNumber(4).status(QueueStatus.CALLED).build();
        when(appointments.lockById(appointmentId)).thenReturn(Optional.of(appointment));
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.of(previous));

        var response = service.checkIn(appointmentId);

        assertEquals(4, response.queueNumber());
        assertEquals(QueueStatus.CALLED, response.status());
        verifyNoInteractions(dayLock);
        verify(visits, never()).saveAndFlush(any());
    }

    @Test
    void unconfirmedAppointmentCannotCheckInAndNeverAllocatesNumber() {
        appointment.setStatus(AppointmentStatus.PENDING);
        when(appointments.lockById(appointmentId)).thenReturn(Optional.of(appointment));
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.empty());
        BusinessException error = assertThrows(BusinessException.class, () -> service.checkIn(appointmentId));
        assertEquals(ErrorCode.CONFLICT, error.getErrorCode());
        verifyNoInteractions(dayLock);
    }

    @Test
    void otherDayCannotCheckIn() {
        appointment.setAppointmentDate(today.plusDays(1));
        when(appointments.lockById(appointmentId)).thenReturn(Optional.of(appointment));
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.empty());
        assertEquals(ErrorCode.CONFLICT,
                assertThrows(BusinessException.class, () -> service.checkIn(appointmentId)).getErrorCode());
        verifyNoInteractions(dayLock);
    }

    @Test
    void receptionistCannotFinishVisit() {
        UUID visitId = UUID.randomUUID();
        ReceptionVisit visit = ReceptionVisit.builder().id(visitId).status(QueueStatus.IN_PROGRESS).build();
        mockLockedVisit(visit);
        CurrentUserPrincipal receptionist = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.local",
                "Reception", Set.of("ROLE_RECEPTIONIST"));

        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.changeStatus(visitId, QueueStatus.COMPLETED, receptionist, "token")).getErrorCode());
        verify(visits, never()).save(any());
    }

    @Test
    void cannotJumpFromWaitingToCompleted() {
        UUID visitId = UUID.randomUUID();
        mockLockedVisit(ReceptionVisit.builder().id(visitId).status(QueueStatus.WAITING).build());
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local",
                "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("token"))
                .thenReturn(new DoctorProfileResponse(doctorId, doctor.id()));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.changeStatus(visitId, QueueStatus.COMPLETED, doctor, "token")).getErrorCode());
        verify(visits, never()).save(any());
    }

    @Test
    void doctorCanFinishInProgressVisit() {
        UUID visitId = UUID.randomUUID();
        ReceptionVisit visit = ReceptionVisit.builder().id(visitId).doctorId(doctorId)
                .status(QueueStatus.IN_PROGRESS).build();
        mockLockedVisit(visit);
        when(visits.saveAndFlush(visit)).thenReturn(visit);
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local",
                "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("token"))
                .thenReturn(new DoctorProfileResponse(doctorId, doctor.id()));
        assertEquals(QueueStatus.COMPLETED, service.changeStatus(visitId, QueueStatus.COMPLETED, doctor, "token").status());
        assertNotNull(visit.getCompletedAt());
        assertEquals(AppointmentStatus.COMPLETED, appointment.getStatus());
        verify(appointmentWrites).saveAndFlush(appointment);
        verify(visits).saveAndFlush(visit);
    }

    @Test
    void doctorCannotModifyAnotherDoctorsVisit() {
        UUID visitId = UUID.randomUUID();
        appointment.setDoctorId(UUID.randomUUID());
        mockLockedVisit(ReceptionVisit.builder().id(visitId).doctorId(appointment.getDoctorId())
                .status(QueueStatus.IN_PROGRESS).build());
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local",
                "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("token"))
                .thenReturn(new DoctorProfileResponse(doctorId, doctor.id()));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.changeStatus(visitId, QueueStatus.COMPLETED, doctor, "token")).getErrorCode());
        verify(visits, never()).saveAndFlush(any());
        verifyNoInteractions(appointmentWrites);
    }

    @Test
    void cannotFinishCancelledAppointment() {
        UUID visitId = UUID.randomUUID();
        ReceptionVisit visit = ReceptionVisit.builder().id(visitId).status(QueueStatus.IN_PROGRESS).build();
        mockLockedVisit(visit);
        appointment.setStatus(AppointmentStatus.CANCELLED);
        CurrentUserPrincipal admin = new CurrentUserPrincipal(UUID.randomUUID(), "admin@test.local",
                "Admin", Set.of("ROLE_ADMIN"));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.changeStatus(visitId, QueueStatus.COMPLETED, admin, "token")).getErrorCode());
        assertEquals(QueueStatus.IN_PROGRESS, visit.getStatus());
        verifyNoInteractions(appointmentWrites);
    }

    @Test
    void receptionistCannotStartVisit() {
        UUID visitId = UUID.randomUUID();
        ReceptionVisit visit = ReceptionVisit.builder().id(visitId).status(QueueStatus.CALLED).build();
        mockLockedVisit(visit);
        CurrentUserPrincipal receptionist = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.local",
                "Reception", Set.of("ROLE_RECEPTIONIST"));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.changeStatus(visitId, QueueStatus.IN_PROGRESS, receptionist, "token")).getErrorCode());
        verifyNoInteractions(appointmentWrites);
    }

    @Test
    void doctorCannotReadOtherDoctorsQueue() {
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local",
                "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("token"))
                .thenReturn(new DoctorProfileResponse(doctorId, doctor.id()));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.list(today, UUID.randomUUID(), doctor, "token")).getErrorCode());
        verifyNoInteractions(visits);
    }

    @Test
    void doctorSeesOnlyTheirOwnQueueWhenFilterIsOmitted() {
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.local",
                "Doctor", Set.of("ROLE_DOCTOR"));
        when(doctorClient.getCurrentDoctorProfile("token"))
                .thenReturn(new DoctorProfileResponse(doctorId, doctor.id()));
        when(visits.findByDoctorIdAndVisitDateOrderByQueueNumberAsc(doctorId, today))
                .thenReturn(java.util.List.of());
        assertTrue(service.list(today, null, doctor, "token").isEmpty());
        verify(visits).findByDoctorIdAndVisitDateOrderByQueueNumberAsc(doctorId, today);
        verify(visits, never()).findByVisitDateOrderByDoctorIdAscQueueNumberAsc(any());
    }

    @Test
    void legacyCompletionBridgeReturnsFalseWhenNoCheckIn() {
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.empty());
        CurrentUserPrincipal admin = new CurrentUserPrincipal(UUID.randomUUID(), "admin@test.local",
                "Admin", Set.of("ROLE_ADMIN"));
        assertFalse(service.completeCheckedInAppointment(appointmentId, admin, "token"));
        verifyNoInteractions(appointments, appointmentWrites);
    }

    @Test
    void legacyCompletionBridgeCompletesBothRecordsForCheckedInBooking() {
        UUID visitId = UUID.randomUUID();
        ReceptionVisit visit = ReceptionVisit.builder().id(visitId).status(QueueStatus.IN_PROGRESS).build();
        mockLockedVisit(visit);
        when(visits.findByAppointmentId(appointmentId)).thenReturn(Optional.of(visit));
        when(visits.saveAndFlush(visit)).thenReturn(visit);
        CurrentUserPrincipal admin = new CurrentUserPrincipal(UUID.randomUUID(), "admin@test.local",
                "Admin", Set.of("ROLE_ADMIN"));
        assertTrue(service.completeCheckedInAppointment(appointmentId, admin, "token"));
        assertEquals(AppointmentStatus.COMPLETED, appointment.getStatus());
        assertEquals(QueueStatus.COMPLETED, visit.getStatus());
        verify(appointmentWrites).saveAndFlush(appointment);
    }

    private void mockLockedVisit(ReceptionVisit visit) {
        visit.setAppointmentId(appointmentId);
        visit.setPatientId(appointment.getPatientId());
        if (visit.getDoctorId() == null) {
            visit.setDoctorId(appointment.getDoctorId());
        }
        when(visits.findById(visit.getId())).thenReturn(Optional.of(visit));
        when(appointments.lockById(appointmentId)).thenReturn(Optional.of(appointment));
        when(visits.lockById(visit.getId())).thenReturn(Optional.of(visit));
    }
}