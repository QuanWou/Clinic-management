package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.repository.AppointmentRepository;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class AppointmentAvailabilityTest {
    @Mock AppointmentRepository appointments;
    @Mock PatientClient patients;
    @Mock DoctorClient doctors;
    @InjectMocks AppointmentServiceImpl service;

    private UUID doctorId;
    private LocalDate date;
    private LocalTime start;
    private LocalTime end;
    private static final String BEARER = "Bearer token";

    @BeforeEach
    void setUp() {
        doctorId = UUID.randomUUID();
        date = LocalDate.now().plusDays(3);
        start = LocalTime.of(9, 0);
        end = LocalTime.of(10, 0);
    }

    private void schedule(boolean available) {
        when(doctors.getAvailability(BEARER, doctorId, date.getDayOfWeek().getValue(), start, end))
                .thenReturn(new DoctorAvailabilityResponse(doctorId, available,
                        date.getDayOfWeek().getValue(), start, end));
    }

    @Test
    void freeScheduleWithoutOverlappingBookingIsAvailable() {
        schedule(true);
        assertTrue(service.getAvailability(BEARER, doctorId, date, start, end).available());
        verify(appointments).existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                doctorId, date, end, start, AppointmentStatus.CANCELLED);
    }

    @Test
    void bookedWorkingSlotIsUnavailable() {
        schedule(true);
        when(appointments.existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                doctorId, date, end, start, AppointmentStatus.CANCELLED)).thenReturn(true);
        assertFalse(service.getAvailability(BEARER, doctorId, date, start, end).available());
    }

    @Test
    void outsideWorkingHoursIsUnavailableWithoutBookingQuery() {
        schedule(false);
        assertFalse(service.getAvailability(BEARER, doctorId, date, start, end).available());
        verifyNoInteractions(appointments, patients);
    }

    @Test
    void invalidRangeIsRejectedBeforeRemoteCalls() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.getAvailability(BEARER, doctorId, date, end, start));
        assertEquals(ErrorCode.VALIDATION_ERROR, error.getErrorCode());
        verifyNoInteractions(appointments, doctors, patients);
    }

    @Test
    void pastBookingIsRejectedBeforeRemoteCalls() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service.getAvailability(BEARER, doctorId, LocalDate.now().minusDays(1), start, end));
        assertEquals(ErrorCode.VALIDATION_ERROR, error.getErrorCode());
        verifyNoInteractions(appointments, doctors, patients);
    }
}
