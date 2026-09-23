package com.clinic.patient.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.InternalPatientSummaryRequest;
import com.clinic.patient.dto.InternalPatientSummaryResponse;
import com.clinic.patient.dto.PatientRecipientResponse;
import com.clinic.patient.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/internal/patients")
@RequiredArgsConstructor
public class InternalPatientController {
    private final PatientService patients;

    @Value("${app.internal.service-key}")
    private String configuredKey;

    @GetMapping("/{patientId}/recipient")
    public ApiResponse<PatientRecipientResponse> recipient(
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String suppliedKey,
            @PathVariable UUID patientId) {
        requireInternalKey(suppliedKey);
        return ApiResponse.success("Recipient resolved", patients.getRecipient(patientId));
    }

    @GetMapping("/{patientId}/summary")
    public ApiResponse<InternalPatientSummaryResponse> summary(
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String suppliedKey,
            @PathVariable UUID patientId) {
        requireInternalKey(suppliedKey);
        return ApiResponse.success("Patient summary resolved", patients.getInternalSummary(patientId));
    }

    @PostMapping("/summaries")
    public ApiResponse<List<InternalPatientSummaryResponse>> summaries(
            @RequestHeader(value = "X-Internal-Service-Key", required = false) String suppliedKey,
            @Valid @RequestBody InternalPatientSummaryRequest request) {
        requireInternalKey(suppliedKey);
        return ApiResponse.success("Patient summaries resolved", patients.getInternalSummaries(request.patientIds()));
    }

    private void requireInternalKey(String suppliedKey) {
        if (suppliedKey == null || configuredKey == null || configuredKey.isBlank()
                || !MessageDigest.isEqual(configuredKey.getBytes(StandardCharsets.UTF_8),
                suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid internal service credential");
        }
    }
}
