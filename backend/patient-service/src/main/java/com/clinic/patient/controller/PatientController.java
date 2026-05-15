package com.clinic.patient.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.dto.UpdatePatientRequest;
import com.clinic.patient.security.CurrentUserPrincipal;
import com.clinic.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @GetMapping("/profile")
    public ApiResponse<PatientProfileResponse> getProfile(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Patient profile retrieved successfully", patientService.getProfile(principal.id()));
    }

    @PutMapping("/profile")
    public ApiResponse<PatientProfileResponse> updateProfile(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody UpdatePatientRequest request
    ) {
        return ApiResponse.success("Patient profile updated successfully", patientService.updateProfile(principal.id(), request));
    }
}
