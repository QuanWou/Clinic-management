package com.clinic.doctor.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.dto.DoctorAvailabilityResponse;
import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.dto.UpdateDoctorRequest;
import com.clinic.doctor.entity.Doctor;
import com.clinic.doctor.entity.Schedule;
import com.clinic.doctor.entity.Specialty;
import com.clinic.doctor.repository.DoctorRepository;
import com.clinic.doctor.repository.ScheduleRepository;
import com.clinic.doctor.repository.SpecialtyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final SpecialtyRepository specialtyRepository;
    private final ScheduleRepository scheduleRepository;

    public DoctorService(
            DoctorRepository doctorRepository,
            SpecialtyRepository specialtyRepository,
            ScheduleRepository scheduleRepository
    ) {
        this.doctorRepository = doctorRepository;
        this.specialtyRepository = specialtyRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional(readOnly = true)
    public DoctorProfileResponse getProfile(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor profile not found"));
        return toResponse(doctor);
    }

    @Transactional
    public DoctorProfileResponse updateProfile(UUID userId, UpdateDoctorRequest request) {
        Specialty specialty = specialtyRepository.findById(request.specialtyId())
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Specialty not found"));

        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseGet(() -> Doctor.builder()
                        .userId(userId)
                        .consultationFee(BigDecimal.ZERO)
                        .build());

        doctor.setSpecialty(specialty);
        doctor.setBiography(request.biography());
        doctor.setConsultationFee(request.consultationFee());

        return toResponse(doctorRepository.save(doctor));
    }

    @Transactional(readOnly = true)
    public DoctorAvailabilityResponse getAvailability(UUID doctorId, Integer dayOfWeek, java.time.LocalTime startTime, java.time.LocalTime endTime) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor not found"));

        Schedule matchingSchedule = scheduleRepository.findByDoctorId(doctor.getId())
                .stream()
                .filter(schedule -> schedule.getDayOfWeek().equals(dayOfWeek))
                .filter(schedule -> !startTime.isBefore(schedule.getStartTime()))
                .filter(schedule -> !endTime.isAfter(schedule.getEndTime()))
                .findFirst()
                .orElse(null);

        return new DoctorAvailabilityResponse(
                doctor.getId(),
                matchingSchedule != null,
                dayOfWeek,
                startTime,
                endTime
        );
    }

    private DoctorProfileResponse toResponse(Doctor doctor) {
        return new DoctorProfileResponse(
                doctor.getId(),
                doctor.getUserId(),
                doctor.getSpecialty() != null ? doctor.getSpecialty().getId() : null,
                doctor.getSpecialty() != null ? doctor.getSpecialty().getName() : null,
                doctor.getBiography(),
                doctor.getConsultationFee()
        );
    }
}
