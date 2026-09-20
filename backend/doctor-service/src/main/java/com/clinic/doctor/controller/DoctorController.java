package com.clinic.doctor.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.doctor.dto.DoctorAvailabilityResponse;
import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.dto.ScheduleResponse;
import com.clinic.doctor.dto.UpdateDoctorProfileRequest;
import com.clinic.doctor.dto.UpdateDoctorRequest;
import com.clinic.doctor.dto.UpdateDoctorSchedulesRequest;
import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping
    public ApiResponse<List<DoctorProfileResponse>> getDoctors(
            @RequestParam(value = "specialtyId", required = false) UUID specialtyId
    ) {
        return ApiResponse.success("Doctors retrieved successfully", doctorService.getDoctors(specialtyId));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<DoctorProfileResponse> getProfile(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Doctor profile retrieved successfully", doctorService.getProfile(principal.id()));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<DoctorProfileResponse> updateProfile(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody UpdateDoctorProfileRequest request
    ) {
        return ApiResponse.success("Doctor profile updated successfully", doctorService.updateProfile(principal.id(), request));
    }

    @GetMapping("/profile/schedules")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<List<ScheduleResponse>> getMySchedules(
            @AuthenticationPrincipal CurrentUserPrincipal principal
    ) {
        return ApiResponse.success("Doctor schedules retrieved successfully", doctorService.getSchedulesByUserId(principal.id()));
    }

    @PutMapping("/profile/schedules")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<List<ScheduleResponse>> replaceMySchedules(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody UpdateDoctorSchedulesRequest request
    ) {
        return ApiResponse.success(
                "Doctor schedules updated successfully",
                doctorService.replaceSchedules(principal.id(), request)
        );
    }

    @GetMapping("/{doctorId}")
    public ApiResponse<DoctorProfileResponse> getDoctor(@PathVariable("doctorId") UUID doctorId) {
        return ApiResponse.success("Doctor retrieved successfully", doctorService.getDoctor(doctorId));
    }

    @GetMapping("/{doctorId}/schedules")
    public ApiResponse<List<ScheduleResponse>> getDoctorSchedules(@PathVariable("doctorId") UUID doctorId) {
        return ApiResponse.success("Doctor schedules retrieved successfully", doctorService.getSchedules(doctorId));
    }

    @GetMapping("/{doctorId}/availability")
    public ApiResponse<DoctorAvailabilityResponse> getAvailability(
            @PathVariable("doctorId") UUID doctorId,
            @RequestParam("dayOfWeek") Integer dayOfWeek,
            @RequestParam("startTime") LocalTime startTime,
            @RequestParam("endTime") LocalTime endTime
    ) {
        return ApiResponse.success(
                "Doctor availability retrieved successfully",
                doctorService.getAvailability(doctorId, dayOfWeek, startTime, endTime)
        );
    }
}
