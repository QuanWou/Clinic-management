package com.clinic.doctor.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.doctor.dto.*;
import com.clinic.doctor.client.AdminIdentityClient;
import com.clinic.doctor.entity.*;
import com.clinic.doctor.repository.*;
import com.clinic.doctor.service.AdminDoctorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class AdminDoctorServiceImpl implements AdminDoctorService {
    private final DoctorRepository doctors;
    private final SpecialtyRepository specialties;
    private final ScheduleRepository schedules;
    private final AdminAuditRepository audits;
    private final AdminIdentityClient identityClient;

    public AdminDoctorServiceImpl(DoctorRepository doctors, SpecialtyRepository specialties,
                                  ScheduleRepository schedules, AdminAuditRepository audits,
                                  AdminIdentityClient identityClient) {
        this.doctors = doctors;
        this.specialties = specialties;
        this.schedules = schedules;
        this.audits = audits;
        this.identityClient = identityClient;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminDoctorResponse> doctors(Pageable pageable) {
        if (pageable.getPageSize() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Maximum page size is 100");
        }
        return doctors.findAll(pageable).map(this::toDoctorResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminDoctorResponse doctor(UUID doctorId) {
        return toDoctorResponse(findDoctor(doctorId));
    }

    @Override
    @Transactional
    public AdminDoctorResponse createDoctor(UUID actorId, String authorization, AdminDoctorRequest request) {
        identityClient.verifyDoctorUser(request.userId(), authorization);
        if (doctors.existsByUserId(request.userId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "User already has a doctor profile");
        }
        Doctor doctor = Doctor.builder()
                .userId(request.userId())
                .specialty(findSpecialty(request.specialtyId()))
                .biography(request.biography())
                .consultationFee(request.consultationFee())
                .active(true)
                .build();
        doctor = doctors.save(doctor);
        audit(actorId, "DOCTOR", doctor.getId(), "CREATE");
        return toDoctorResponse(doctor);
    }

    @Override
    @Transactional
    public AdminDoctorResponse updateDoctor(UUID actorId, UUID doctorId, UpdateAdminDoctorRequest request) {
        Doctor doctor = lockedDoctor(doctorId);
        doctor.setSpecialty(findSpecialty(request.specialtyId()));
        doctor.setBiography(request.biography());
        doctor.setConsultationFee(request.consultationFee());
        doctor.setActive(request.active());
        audit(actorId, "DOCTOR", doctorId, "UPDATE");
        return toDoctorResponse(doctor);
    }

    @Override
    @Transactional
    public AdminDoctorResponse deactivateDoctor(UUID actorId, UUID doctorId) {
        Doctor doctor = lockedDoctor(doctorId);
        if (doctor.isActive()) {
            doctor.setActive(false);
            audit(actorId, "DOCTOR", doctorId, "DEACTIVATE");
        }
        return toDoctorResponse(doctor);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SpecialtyResponse> specialties() {
        return specialties.findAll().stream().map(this::toSpecialtyResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SpecialtyResponse specialty(UUID id) {
        return toSpecialtyResponse(findSpecialty(id));
    }

    @Override
    @Transactional
    public SpecialtyResponse createSpecialty(UUID actorId, SpecialtyRequest request) {
        String name = request.name().trim();
        if (specialties.existsByNameIgnoreCase(name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Specialty already exists");
        }
        Specialty specialty = Specialty.builder().name(name).description(request.description()).build();
        specialty = specialties.save(specialty);
        audit(actorId, "SPECIALTY", specialty.getId(), "CREATE");
        return toSpecialtyResponse(specialty);
    }

    @Override
    @Transactional
    public SpecialtyResponse updateSpecialty(UUID actorId, UUID id, SpecialtyRequest request) {
        Specialty specialty = findSpecialty(id);
        String name = request.name().trim();
        if (!specialty.getName().equalsIgnoreCase(name) && specialties.existsByNameIgnoreCase(name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Specialty already exists");
        }
        specialty.setName(name);
        specialty.setDescription(request.description());
        audit(actorId, "SPECIALTY", id, "UPDATE");
        return toSpecialtyResponse(specialty);
    }

    @Override
    @Transactional
    public void deleteSpecialty(UUID actorId, UUID id) {
        Specialty specialty = findSpecialty(id);
        if (doctors.existsBySpecialtyId(id)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Specialty is in use by doctors");
        }
        specialties.delete(specialty);
        audit(actorId, "SPECIALTY", id, "DELETE");
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleResponse> schedules(UUID doctorId) {
        findDoctor(doctorId);
        return schedules.findByDoctorId(doctorId).stream().map(this::toScheduleResponse).toList();
    }

    @Override
    @Transactional
    public ScheduleResponse createSchedule(UUID actorId, UUID doctorId, ScheduleRequest request) {
        Doctor doctor = lockedDoctor(doctorId);
        validateSchedule(doctorId, null, request);
        Schedule schedule = Schedule.builder().doctor(doctor).dayOfWeek(request.dayOfWeek())
                .startTime(request.startTime()).endTime(request.endTime()).build();
        schedule = schedules.save(schedule);
        audit(actorId, "SCHEDULE", schedule.getId(), "CREATE");
        return toScheduleResponse(schedule);
    }

    @Override
    @Transactional
    public ScheduleResponse updateSchedule(UUID actorId, UUID doctorId, UUID scheduleId, ScheduleRequest request) {
        lockedDoctor(doctorId);
        Schedule schedule = findOwnedSchedule(doctorId, scheduleId);
        validateSchedule(doctorId, scheduleId, request);
        schedule.setDayOfWeek(request.dayOfWeek());
        schedule.setStartTime(request.startTime());
        schedule.setEndTime(request.endTime());
        audit(actorId, "SCHEDULE", scheduleId, "UPDATE");
        return toScheduleResponse(schedule);
    }

    @Override
    @Transactional
    public void deleteSchedule(UUID actorId, UUID doctorId, UUID scheduleId) {
        lockedDoctor(doctorId);
        Schedule schedule = findOwnedSchedule(doctorId, scheduleId);
        schedules.delete(schedule);
        audit(actorId, "SCHEDULE", scheduleId, "DELETE");
    }

    private void validateSchedule(UUID doctorId, UUID excludeId, ScheduleRequest request) {
        if (request.startTime() == null || request.endTime() == null
                || !request.startTime().isBefore(request.endTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Start time must be before end time");
        }
        if (schedules.findByDoctorId(doctorId).stream()
                .filter(schedule -> schedule.getDayOfWeek().equals(request.dayOfWeek()))
                .filter(schedule -> !schedule.getId().equals(excludeId))
                .anyMatch(schedule -> schedule.getStartTime().isBefore(request.endTime())
                        && schedule.getEndTime().isAfter(request.startTime()))) {
            throw new BusinessException(ErrorCode.CONFLICT, "Doctor schedule overlaps an existing schedule");
        }
    }

    private Schedule findOwnedSchedule(UUID doctorId, UUID scheduleId) {
        Schedule schedule = schedules.findById(scheduleId).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Schedule not found"));
        if (!schedule.getDoctor().getId().equals(doctorId)) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Schedule not found");
        }
        return schedule;
    }

    private Doctor findDoctor(UUID id) {
        return doctors.findById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor not found"));
    }

    private Doctor lockedDoctor(UUID id) {
        return doctors.findLockedById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Doctor not found"));
    }

    private Specialty findSpecialty(UUID id) {
        return specialties.findById(id).orElseThrow(() ->
                new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Specialty not found"));
    }

    private SpecialtyResponse toSpecialtyResponse(Specialty specialty) {
        return new SpecialtyResponse(specialty.getId(), specialty.getName(), specialty.getDescription());
    }

    private AdminDoctorResponse toDoctorResponse(Doctor doctor) {
        return new AdminDoctorResponse(doctor.getId(), doctor.getUserId(), doctor.getSpecialty().getId(),
                doctor.getSpecialty().getName(), doctor.getBiography(), doctor.getConsultationFee(), doctor.isActive());
    }

    private ScheduleResponse toScheduleResponse(Schedule schedule) {
        return new ScheduleResponse(schedule.getId(), schedule.getDoctor().getId(), schedule.getDayOfWeek(),
                schedule.getStartTime(), schedule.getEndTime());
    }

    private void audit(UUID actorId, String resourceType, UUID resourceId, String action) {
        AdminAudit audit = new AdminAudit();
        audit.setId(UUID.randomUUID());
        audit.setActorUserId(actorId);
        audit.setResourceType(resourceType);
        audit.setResourceId(resourceId);
        audit.setAction(action);
        audit.setCreatedAt(LocalDateTime.now());
        audits.save(audit);
        log.info("Admin {} performed {} on {} {}", actorId, action, resourceType, resourceId);
    }
}