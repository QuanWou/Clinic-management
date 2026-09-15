package com.clinic.medicalrecord.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.medicalrecord.dto.CreateMedicalRecordRequest;
import com.clinic.medicalrecord.dto.MedicalRecordResponse;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.MedicalRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/medical-records")
@RequiredArgsConstructor
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    @PostMapping
    public ApiResponse<MedicalRecordResponse> create(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @Valid @RequestBody CreateMedicalRecordRequest request
    ) {
        return ApiResponse.success(
                "Medical record created successfully",
                medicalRecordService.create(principal.id(), authorizationHeader, principal, request)
        );
    }

    @GetMapping("/my")
    public ApiResponse<List<MedicalRecordResponse>> getMyRecords(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader
    ) {
        return ApiResponse.success(
                "Medical records fetched successfully",
                medicalRecordService.getMyRecords(principal.id(), authorizationHeader, principal)
        );
    }

    @GetMapping("/patients/{patientId}")
    public ApiResponse<List<MedicalRecordResponse>> getByPatientId(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("patientId") UUID patientId
    ) {
        return ApiResponse.success(
                "Patient medical records fetched successfully",
                medicalRecordService.getByPatientId(principal.id(), authorizationHeader, principal, patientId)
        );
    }

    @GetMapping("/{id}")
    public ApiResponse<MedicalRecordResponse> getById(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Medical record fetched successfully",
                medicalRecordService.getById(principal.id(), authorizationHeader, principal, id)
        );
    }
}
