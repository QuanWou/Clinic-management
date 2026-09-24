package com.clinic.doctor.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.doctor.dto.*;
import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.service.AdminDoctorService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDoctorController {
    private final AdminDoctorService service;

    public AdminDoctorController(AdminDoctorService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<Page<AdminDoctorResponse>> list(Pageable pageable) {
        return ApiResponse.success(service.doctors(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminDoctorResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.doctor(id));
    }

    @PostMapping
    public ApiResponse<AdminDoctorResponse> create(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                    @RequestHeader("Authorization") String authorization,
                                                    @Valid @RequestBody AdminDoctorRequest request) {
        return ApiResponse.success("Doctor created", service.createDoctor(principal.id(), authorization, request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminDoctorResponse> update(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                    @PathVariable UUID id,
                                                    @Valid @RequestBody UpdateAdminDoctorRequest request) {
        return ApiResponse.success("Doctor updated", service.updateDoctor(principal.id(), id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<AdminDoctorResponse> deactivate(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                        @PathVariable UUID id) {
        return ApiResponse.success("Doctor deactivated", service.deactivateDoctor(principal.id(), id));
    }

    @GetMapping("/{doctorId}/schedules")
    public ApiResponse<List<ScheduleResponse>> schedules(@PathVariable UUID doctorId) {
        return ApiResponse.success(service.schedules(doctorId));
    }

    @PostMapping("/{doctorId}/schedules")
    public ApiResponse<ScheduleResponse> createSchedule(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                         @PathVariable UUID doctorId,
                                                         @Valid @RequestBody ScheduleRequest request) {
        return ApiResponse.success("Schedule created", service.createSchedule(principal.id(), doctorId, request));
    }

    @PutMapping("/{doctorId}/schedules/{scheduleId}")
    public ApiResponse<ScheduleResponse> updateSchedule(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                         @PathVariable UUID doctorId, @PathVariable UUID scheduleId,
                                                         @Valid @RequestBody ScheduleRequest request) {
        return ApiResponse.success("Schedule updated", service.updateSchedule(principal.id(), doctorId, scheduleId, request));
    }

    @DeleteMapping("/{doctorId}/schedules/{scheduleId}")
    public ApiResponse<Void> deleteSchedule(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                             @PathVariable UUID doctorId, @PathVariable UUID scheduleId) {
        service.deleteSchedule(principal.id(), doctorId, scheduleId);
        return ApiResponse.success("Schedule deleted", null);
    }
}