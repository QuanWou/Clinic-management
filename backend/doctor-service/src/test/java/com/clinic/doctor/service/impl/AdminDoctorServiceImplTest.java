package com.clinic.doctor.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.client.AdminIdentityClient;
import com.clinic.doctor.dto.*;
import com.clinic.doctor.entity.*;
import com.clinic.doctor.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDoctorServiceImplTest {
    @Mock DoctorRepository doctors;
    @Mock SpecialtyRepository specialties;
    @Mock ScheduleRepository schedules;
    @Mock AdminAuditRepository audits;
    @Mock AdminIdentityClient identity;
    AdminDoctorServiceImpl service;
    UUID actor = UUID.randomUUID();
    UUID doctorId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        service = new AdminDoctorServiceImpl(doctors, specialties, schedules, audits, identity);
    }

    @Test
    void rejectsOverlappingSchedule() {
        Doctor doctor = doctor();
        when(doctors.findLockedById(doctorId)).thenReturn(Optional.of(doctor));
        Schedule existing = Schedule.builder().id(UUID.randomUUID()).doctor(doctor).dayOfWeek(1)
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(12, 0)).build();
        when(schedules.findByDoctorId(doctorId)).thenReturn(List.of(existing));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createSchedule(actor,
                doctorId, new ScheduleRequest(1, LocalTime.of(11, 0), LocalTime.of(13, 0))));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(schedules, never()).save(any());
        verifyNoInteractions(audits);
    }

    @Test
    void rejectsScheduleOnWrongDoctor() {
        when(doctors.findLockedById(doctorId)).thenReturn(Optional.of(doctor()));
        Schedule schedule = Schedule.builder().id(UUID.randomUUID())
                .doctor(Doctor.builder().id(UUID.randomUUID()).build()).build();
        when(schedules.findById(schedule.getId())).thenReturn(Optional.of(schedule));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.deleteSchedule(actor, doctorId, schedule.getId()));
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND, ex.getErrorCode());
        verify(schedules, never()).delete(any());
    }

    @Test
    void deactivationRetainsDoctorAndBlocksAvailability() {
        Doctor doctor = doctor();
        when(doctors.findLockedById(doctorId)).thenReturn(Optional.of(doctor));
        assertFalse(service.deactivateDoctor(actor, doctorId).active());
        verify(doctors, never()).delete(any());
        verify(audits).save(argThat(a -> "DEACTIVATE".equals(a.getAction())));
    }

    @Test
    void createChecksIdentityFirst() {
        UUID userId = UUID.randomUUID();
        AdminDoctorRequest request = new AdminDoctorRequest(userId, UUID.randomUUID(), null, BigDecimal.ZERO);
        doThrow(new BusinessException(ErrorCode.CONFLICT, "Invalid account"))
                .when(identity).verifyDoctorUser(userId, "Bearer test");
        assertThrows(BusinessException.class, () -> service.createDoctor(actor, "Bearer test", request));
        verifyNoInteractions(doctors, specialties, audits);
    }

    private Doctor doctor() {
        Specialty specialty = Specialty.builder().id(UUID.randomUUID()).name("General").build();
        return Doctor.builder().id(doctorId).userId(UUID.randomUUID()).specialty(specialty)
                .consultationFee(BigDecimal.ZERO).active(true).build();
    }
}