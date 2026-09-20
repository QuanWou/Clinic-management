package com.clinic.doctor.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.dto.DoctorAvailabilityResponse;
import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.dto.DoctorScheduleRequest;
import com.clinic.doctor.dto.ScheduleResponse;
import com.clinic.doctor.dto.UpdateDoctorProfileRequest;
import com.clinic.doctor.dto.UpdateDoctorSchedulesRequest;
import com.clinic.doctor.entity.Doctor;
import com.clinic.doctor.entity.Schedule;
import com.clinic.doctor.repository.DoctorRepository;
import com.clinic.doctor.repository.ScheduleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final ScheduleRepository scheduleRepository;

    public DoctorService(
            DoctorRepository doctorRepository,
            ScheduleRepository scheduleRepository
    ) {
        this.doctorRepository = doctorRepository;
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional(readOnly = true)
    public List<DoctorProfileResponse> listDoctors() {
        return doctorRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DoctorProfileResponse getProfile(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor profile not found"));
        return toResponse(doctor);
    }

    @Transactional(readOnly = true)
    public List<DoctorProfileResponse> getDoctors(UUID specialtyId) {
        List<Doctor> doctors = specialtyId == null
                ? doctorRepository.findAll()
                : doctorRepository.findBySpecialtyId(specialtyId);

        return doctors.stream()
                .sorted(Comparator
                        .comparing((Doctor doctor) -> doctor.getSpecialty().getName(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Doctor::getId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DoctorProfileResponse getDoctor(UUID doctorId) {
        return toResponse(findDoctor(doctorId));
    }

    @Transactional
    public DoctorProfileResponse updateProfile(UUID userId, UpdateDoctorProfileRequest request) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        "Doctor profile must be created by an administrator"
                ));
        doctor.setBiography(normalizeNullable(request.biography()));
        return toResponse(doctorRepository.save(doctor));
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> getSchedulesByUserId(UUID userId) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor profile not found"));
        return getScheduleResponses(doctor.getId());
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> getSchedules(UUID doctorId) {
        Doctor doctor = findDoctor(doctorId);
        return getScheduleResponses(doctor.getId());
    }

    @Transactional
    public List<ScheduleResponse> replaceSchedules(UUID userId, UpdateDoctorSchedulesRequest request) {
        Doctor doctor = doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor profile not found"));
        List<DoctorScheduleRequest> requestedSchedules = request.schedules();
        validateSchedules(requestedSchedules);

        scheduleRepository.deleteByDoctorId(doctor.getId());
        List<Schedule> schedules = requestedSchedules.stream()
                .map(item -> Schedule.builder()
                        .doctor(doctor)
                        .dayOfWeek(item.dayOfWeek())
                        .startTime(item.startTime())
                        .endTime(item.endTime())
                        .build())
                .toList();

        return scheduleRepository.saveAll(schedules)
                .stream()
                .sorted(scheduleComparator())
                .map(this::toScheduleResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DoctorAvailabilityResponse getAvailability(UUID doctorId, Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {
        validateTimeRange(dayOfWeek, startTime, endTime);
        Doctor doctor = findDoctor(doctorId);

        Schedule matchingSchedule = scheduleRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctor.getId())
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

    private Doctor findDoctor(UUID doctorId) {
        return doctorRepository.findById(doctorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor not found"));
    }

    private List<ScheduleResponse> getScheduleResponses(UUID doctorId) {
        return scheduleRepository.findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(doctorId)
                .stream()
                .map(this::toScheduleResponse)
                .toList();
    }

    private void validateSchedules(List<DoctorScheduleRequest> schedules) {
        if (schedules == null) {
            throw validationError("Schedules are required");
        }

        List<DoctorScheduleRequest> orderedSchedules = new ArrayList<>(schedules);
        if (orderedSchedules.stream().anyMatch(java.util.Objects::isNull)) {
            throw validationError("Schedule entry is required");
        }
        orderedSchedules.forEach(schedule -> validateTimeRange(
                schedule.dayOfWeek(), schedule.startTime(), schedule.endTime()
        ));
        orderedSchedules.sort(Comparator
                .comparing(DoctorScheduleRequest::dayOfWeek)
                .thenComparing(DoctorScheduleRequest::startTime));

        DoctorScheduleRequest previous = null;
        for (DoctorScheduleRequest current : orderedSchedules) {
            if (previous != null
                    && previous.dayOfWeek().equals(current.dayOfWeek())
                    && current.startTime().isBefore(previous.endTime())) {
                throw validationError("Doctor schedules must not overlap on the same day");
            }
            previous = current;
        }
    }

    private void validateTimeRange(Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {
        if (dayOfWeek == null || dayOfWeek < 1 || dayOfWeek > 7) {
            throw validationError("Day of week must be between 1 and 7");
        }
        if (startTime == null || endTime == null || !endTime.isAfter(startTime)) {
            throw validationError("End time must be after start time");
        }
    }

    private BusinessException validationError(String message) {
        return new BusinessException(ErrorCode.VALIDATION_ERROR, message);
    }

    private Comparator<Schedule> scheduleComparator() {
        return Comparator.comparing(Schedule::getDayOfWeek).thenComparing(Schedule::getStartTime);
    }

    private ScheduleResponse toScheduleResponse(Schedule schedule) {
        return new ScheduleResponse(
                schedule.getId(),
                schedule.getDayOfWeek(),
                schedule.getStartTime(),
                schedule.getEndTime()
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

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
