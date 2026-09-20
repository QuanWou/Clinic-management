package com.clinic.appointment.service;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.ReceptionPatientLookupResponse;
import com.clinic.appointment.client.RecipientDirectoryClient;
import com.clinic.appointment.dto.CreateReceptionAppointmentRequest;
import com.clinic.appointment.dto.RescheduleReceptionAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.ReceptionVisit;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import com.clinic.appointment.repository.ReceptionAppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReceptionSchedulingServiceTest {
    @Mock AppointmentRepository appointments;
    @Mock ReceptionAppointmentRepository receptionAppointments;
    @Mock ReceptionVisitRepository visits;
    @Mock PatientClient patientClient;
    @Mock DoctorClient doctorClient;
    @Mock BookingDayLock bookingLock;
    @Mock AppointmentNotificationOutboxRepository notificationOutbox;
    @Mock RecipientDirectoryClient recipients;
    @InjectMocks ReceptionSchedulingService service;

    private UUID patientId;
    private UUID doctorId;
    private LocalDate date;

    @BeforeEach
    void setup() {
        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        date = LocalDate.now().plusDays(1);
    }

    @Test
    void bookChecksPatientAvailabilityAndOverlapBeforeSaving() {
        var request = new CreateReceptionAppointmentRequest(patientId, doctorId, date,
                LocalTime.of(9, 0), LocalTime.of(10, 0), "Consultation");
        when(patientClient.getPatientForReception("Bearer token", patientId))
                .thenReturn(new ReceptionPatientLookupResponse(patientId, UUID.randomUUID()));
        when(doctorClient.getAvailability(eq("Bearer token"), eq(doctorId), eq(date.getDayOfWeek().getValue()),
                any(), any())).thenReturn(new DoctorAvailabilityResponse(doctorId, true,
                date.getDayOfWeek().getValue(), request.startTime(), request.endTime()));
        when(appointments.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));

        var result = service.book("Bearer token", request);

        assertEquals(patientId, result.patientId());
        assertEquals(AppointmentStatus.PENDING, result.status());
        var order = inOrder(patientClient, doctorClient, bookingLock, receptionAppointments, appointments);
        order.verify(patientClient).getPatientForReception("Bearer token", patientId);
        order.verify(doctorClient).getAvailability(eq("Bearer token"), eq(doctorId), anyInt(), any(), any());
        order.verify(bookingLock).lock(doctorId, date);
        order.verify(receptionAppointments).hasOverlap(eq(doctorId), eq(date), any(), any(),
                eq(AppointmentStatus.CANCELLED));
        order.verify(appointments).saveAndFlush(any());
    }

    @Test
    void overlappingBookingDoesNotSave() {
        var request = new CreateReceptionAppointmentRequest(patientId, doctorId, date,
                LocalTime.of(9, 0), LocalTime.of(10, 0), "Consultation");
        when(patientClient.getPatientForReception(any(), eq(patientId)))
                .thenReturn(new ReceptionPatientLookupResponse(patientId, UUID.randomUUID()));
        when(doctorClient.getAvailability(any(), any(), any(), any(), any()))
                .thenReturn(new DoctorAvailabilityResponse(doctorId, true, 1, request.startTime(), request.endTime()));
        when(receptionAppointments.hasOverlap(eq(doctorId), eq(date), any(), any(), any()))
                .thenReturn(true);

        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.book("Bearer token", request)).getErrorCode());
        verify(appointments, never()).saveAndFlush(any());
    }

    @Test
    void cancelAfterCheckInIsRejectedWithoutMutation() {
        UUID id = UUID.randomUUID();
        Appointment booking = Appointment.builder().id(id).status(AppointmentStatus.CONFIRMED).build();
        when(receptionAppointments.lockById(id)).thenReturn(Optional.of(booking));
        when(visits.findByAppointmentId(id)).thenReturn(Optional.of(ReceptionVisit.builder().build()));

        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.cancel(id)).getErrorCode());
        assertEquals(AppointmentStatus.CONFIRMED, booking.getStatus());
        verify(appointments, never()).saveAndFlush(any());
    }

    @Test
    void failedRescheduleDoesNotModifyOriginalBooking() {
        UUID id = UUID.randomUUID();
        Appointment booking = Appointment.builder().id(id).patientId(patientId).doctorId(doctorId)
                .appointmentDate(date).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0))
                .status(AppointmentStatus.CONFIRMED).build();
        when(receptionAppointments.lockById(id)).thenReturn(Optional.of(booking));
        when(visits.findByAppointmentId(id)).thenReturn(Optional.empty());
        when(doctorClient.getAvailability(any(), any(), any(), any(), any()))
                .thenReturn(new DoctorAvailabilityResponse(doctorId, true, 1, LocalTime.NOON, LocalTime.of(13, 0)));
        when(receptionAppointments.hasOverlapExcluding(eq(doctorId), eq(date), any(), any(), any(), eq(id)))
                .thenReturn(true);

        var request = new RescheduleReceptionAppointmentRequest(doctorId, date,
                LocalTime.NOON, LocalTime.of(13, 0));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.reschedule("Bearer token", id, request)).getErrorCode());
        assertEquals(LocalTime.of(9, 0), booking.getStartTime());
        assertEquals(AppointmentStatus.CONFIRMED, booking.getStatus());
        verify(appointments, never()).saveAndFlush(any());
    }

    @Test
    void cannotBookEarlierTodayInClinicTimezone() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        var request = new CreateReceptionAppointmentRequest(patientId, doctorId, today,
                LocalTime.MIDNIGHT, LocalTime.of(1, 0), "Past appointment");
        assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                () -> service.book("Bearer token", request)).getErrorCode());
        verifyNoInteractions(patientClient, doctorClient, appointments, bookingLock);
    }

    @Test
    void cannotRescheduleToEarlierTodayInClinicTimezone() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        var request = new RescheduleReceptionAppointmentRequest(doctorId, today,
                LocalTime.MIDNIGHT, LocalTime.of(1, 0));
        assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                () -> service.reschedule("Bearer token", UUID.randomUUID(), request)).getErrorCode());
        verifyNoInteractions(receptionAppointments, visits, bookingLock, doctorClient);
    }

    @Test
    void exclusionConstraintRaceIsReportedAsConflict() {
        var request = new CreateReceptionAppointmentRequest(patientId, doctorId, date,
                LocalTime.of(9, 0), LocalTime.of(10, 0), "Consultation");
        when(patientClient.getPatientForReception("Bearer token", patientId))
                .thenReturn(new ReceptionPatientLookupResponse(patientId, UUID.randomUUID()));
        when(doctorClient.getAvailability(any(), any(), any(), any(), any()))
                .thenReturn(new DoctorAvailabilityResponse(doctorId, true, 1, request.startTime(), request.endTime()));
        when(appointments.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException(
                "exclusion constraint", new SQLException("conflicting key", "23P01")));

        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.book("Bearer token", request)).getErrorCode());
        verify(appointments).saveAndFlush(any());
    }
}
