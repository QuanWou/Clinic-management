package com.clinic.doctor.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.dto.DoctorAvailabilityResponse;
import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.dto.DoctorScheduleRequest;
import com.clinic.doctor.dto.ScheduleResponse;
import com.clinic.doctor.dto.UpdateDoctorSchedulesRequest;
import com.clinic.doctor.entity.Doctor;
import com.clinic.doctor.entity.Schedule;
import com.clinic.doctor.entity.Specialty;
import com.clinic.doctor.repository.DoctorRepository;
import com.clinic.doctor.repository.ScheduleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DoctorServiceTest {

    @Mock
    private DoctorRepository doctorRepository;

    @Mock
    private ScheduleRepository scheduleRepository;

    @InjectMocks
    private DoctorService doctorService;

    @Test
    void filtersDoctorsBySpecialty() {
        UUID specialtyId = UUID.randomUUID();
        Doctor doctor = doctor(UUID.randomUUID(), specialty(specialtyId, "Cardiology"));
        when(doctorRepository.findBySpecialtyId(specialtyId)).thenReturn(List.of(doctor));

        List<DoctorProfileResponse> result = doctorService.getDoctors(specialtyId);

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo(doctor.getId());
            assertThat(item.specialtyName()).isEqualTo("Cardiology");
        });
        verify(doctorRepository, never()).findAll();
    }

    @Test
    void replacesAndSortsWeeklySchedules() {
        UUID userId = UUID.randomUUID();
        Doctor doctor = doctor(UUID.randomUUID(), specialty(UUID.randomUUID(), "General Medicine"));
        when(doctorRepository.findByUserId(userId)).thenReturn(Optional.of(doctor));
        when(scheduleRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        List<ScheduleResponse> result = doctorService.replaceSchedules(userId, new UpdateDoctorSchedulesRequest(List.of(
                new DoctorScheduleRequest(3, LocalTime.of(13, 0), LocalTime.of(17, 0)),
                new DoctorScheduleRequest(1, LocalTime.of(8, 0), LocalTime.of(12, 0)),
                new DoctorScheduleRequest(3, LocalTime.of(8, 0), LocalTime.of(12, 0))
        )));

        assertThat(result).extracting(ScheduleResponse::dayOfWeek).containsExactly(1, 3, 3);
        assertThat(result).extracting(ScheduleResponse::startTime)
                .containsExactly(LocalTime.of(8, 0), LocalTime.of(8, 0), LocalTime.of(13, 0));
        verify(scheduleRepository).deleteByDoctorId(doctor.getId());
        ArgumentCaptor<List<Schedule>> captor = ArgumentCaptor.forClass(List.class);
        verify(scheduleRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).allSatisfy(schedule -> assertThat(schedule.getDoctor()).isSameAs(doctor));
    }

    @Test
    void rejectsOverlappingSchedulesWithoutDeletingExistingOnes() {
        UUID userId = UUID.randomUUID();
        Doctor doctor = doctor(UUID.randomUUID(), specialty(UUID.randomUUID(), "Pediatrics"));
        when(doctorRepository.findByUserId(userId)).thenReturn(Optional.of(doctor));

        UpdateDoctorSchedulesRequest request = new UpdateDoctorSchedulesRequest(List.of(
                new DoctorScheduleRequest(2, LocalTime.of(8, 0), LocalTime.of(12, 0)),
                new DoctorScheduleRequest(2, LocalTime.of(11, 30), LocalTime.of(15, 0))
        ));

        assertThatThrownBy(() -> doctorService.replaceSchedules(userId, request))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(exception.getMessage()).contains("must not overlap");
                });
        verify(scheduleRepository, never()).deleteByDoctorId(doctor.getId());
        verify(scheduleRepository, never()).saveAll(anyList());
    }

    @Test
    void reportsAvailabilityWhenRequestedRangeIsInsideWorkingHours() {
        Doctor doctor = doctor(UUID.randomUUID(), specialty(UUID.randomUUID(), "Oncology"));
        Schedule schedule = Schedule.builder()
                .doctor(doctor)
                .dayOfWeek(5)
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .build();
        when(doctorRepository.findById(doctor.getId())).thenReturn(Optional.of(doctor));
        when(scheduleRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctor.getId()))
                .thenReturn(List.of(schedule));

        DoctorAvailabilityResponse result = doctorService.getAvailability(
                doctor.getId(), 5, LocalTime.of(9, 0), LocalTime.of(9, 30)
        );

        assertThat(result.available()).isTrue();
    }

    @Test
    void rejectsInvalidAvailabilityRangeBeforeReadingDoctor() {
        UUID doctorId = UUID.randomUUID();

        assertThatThrownBy(() -> doctorService.getAvailability(
                doctorId, 8, LocalTime.of(9, 0), LocalTime.of(8, 30)
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));

        verify(doctorRepository, never()).findById(doctorId);
    }

    private Doctor doctor(UUID id, Specialty specialty) {
        return Doctor.builder()
                .id(id)
                .userId(UUID.randomUUID())
                .specialty(specialty)
                .biography("Biography")
                .consultationFee(new BigDecimal("300000.00"))
                .build();
    }

    private Specialty specialty(UUID id, String name) {
        return Specialty.builder().id(id).name(name).build();
    }
}
