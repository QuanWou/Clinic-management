package com.clinic.medicalrecord.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.medicalrecord.dto.PrescriptionResponse;
import com.clinic.medicalrecord.dto.SavePrescriptionDraftRequest;
import com.clinic.medicalrecord.dto.SignPrescriptionRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.PrescriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/medical-records/{recordId}/prescriptions")
@RequiredArgsConstructor
public class PrescriptionController {
    private final PrescriptionService prescriptions;

    @GetMapping
    public ApiResponse<List<PrescriptionResponse>> list(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID recordId) {
        return ApiResponse.success("Prescriptions fetched",
                prescriptions.list(principal, authorization, recordId));
    }

    @PutMapping("/draft")
    public ApiResponse<PrescriptionResponse> saveDraft(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID recordId,
            @Valid @RequestBody SavePrescriptionDraftRequest request) {
        return ApiResponse.success("Prescription draft saved",
                prescriptions.saveDraft(principal, authorization, recordId, request));
    }

    @PostMapping("/{prescriptionId}/sign")
    public ApiResponse<PrescriptionResponse> sign(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID recordId,
            @PathVariable UUID prescriptionId,
            @Valid @RequestBody SignPrescriptionRequest request) {
        return ApiResponse.success("Prescription signed",
                prescriptions.sign(principal, authorization, recordId, prescriptionId, request));
    }
}
