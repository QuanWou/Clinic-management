package com.clinic.doctor.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.dto.UpdateDoctorProfileRequest;
import com.clinic.doctor.entity.Doctor;
import com.clinic.doctor.entity.Specialty;
import com.clinic.doctor.repository.DoctorRepository;
import com.clinic.doctor.repository.ScheduleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoctorProfileServiceTest {
    @Mock DoctorRepository doctors;
    @Mock ScheduleRepository schedules;

    @Test
    void biographyUpdatePreservesAdminOwnedFields() {
        UUID userId = UUID.randomUUID();
        Specialty specialty = Specialty.builder().id(UUID.randomUUID()).name("Cardiology").build();
        Doctor doctor = Doctor.builder().id(UUID.randomUUID()).userId(userId)
                .specialty(specialty).consultationFee(new BigDecimal("350000.00"))
                .biography("Old").build();
        when(doctors.findByUserId(userId)).thenReturn(Optional.of(doctor));
        when(doctors.save(doctor)).thenReturn(doctor);

        var result = new DoctorService(doctors, schedules)
                .updateProfile(userId, new UpdateDoctorProfileRequest("New biography"));

        assertEquals("New biography", result.biography());
        assertEquals(specialty.getId(), result.specialtyId());
        assertEquals(new BigDecimal("350000.00"), result.consultationFee());
        verify(doctors).save(doctor);
    }

    @Test
    void doctorCannotSelfCreateAdministrativeProfile() {
        UUID userId = UUID.randomUUID();
        when(doctors.findByUserId(userId)).thenReturn(Optional.empty());
        var ex = assertThrows(BusinessException.class, () -> new DoctorService(doctors, schedules)
                .updateProfile(userId, new UpdateDoctorProfileRequest("Biography")));
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND, ex.getErrorCode());
        verify(doctors, never()).save(any());
    }
}