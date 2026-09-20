package com.clinic.doctor.service;

import com.clinic.doctor.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface AdminDoctorService {
    Page<AdminDoctorResponse> doctors(Pageable pageable);
    AdminDoctorResponse doctor(UUID doctorId);
    AdminDoctorResponse createDoctor(UUID actorId, String authorization, AdminDoctorRequest request);
    AdminDoctorResponse updateDoctor(UUID actorId, UUID doctorId, UpdateAdminDoctorRequest request);
    AdminDoctorResponse deactivateDoctor(UUID actorId, UUID doctorId);
    List<SpecialtyResponse> specialties();
    SpecialtyResponse specialty(UUID id);
    SpecialtyResponse createSpecialty(UUID actorId, SpecialtyRequest request);
    SpecialtyResponse updateSpecialty(UUID actorId, UUID id, SpecialtyRequest request);
    void deleteSpecialty(UUID actorId, UUID id);
    List<ScheduleResponse> schedules(UUID doctorId);
    ScheduleResponse createSchedule(UUID actorId, UUID doctorId, ScheduleRequest request);
    ScheduleResponse updateSchedule(UUID actorId, UUID doctorId, UUID scheduleId, ScheduleRequest request);
    void deleteSchedule(UUID actorId, UUID doctorId, UUID scheduleId);
}