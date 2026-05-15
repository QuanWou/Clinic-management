package com.clinic.doctor.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.doctor.dto.DoctorAvailabilityResponse;
import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.dto.UpdateDoctorRequest;
import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @GetMapping("/profile")
    public ApiResponse<DoctorProfileResponse> getProfile(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Doctor profile retrieved successfully", doctorService.getProfile(principal.id()));
    }

    @PutMapping("/profile")
    public ApiResponse<DoctorProfileResponse> updateProfile(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody UpdateDoctorRequest request
    ) {
        return ApiResponse.success("Doctor profile updated successfully", doctorService.updateProfile(principal.id(), request));
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
