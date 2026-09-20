package com.clinic.patient.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.PatientRecipientResponse;
import com.clinic.patient.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
        if (suppliedKey == null || configuredKey == null || configuredKey.isBlank()
                || !MessageDigest.isEqual(configuredKey.getBytes(StandardCharsets.UTF_8),
                suppliedKey.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid internal service credential");
        }
        return ApiResponse.success("Recipient resolved", patients.getRecipient(patientId));
    }
}
