package com.clinic.medicalrecord.dto;

import com.clinic.medicalrecord.entity.LabOrderStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record LabOrderResponse(
        UUID id,
        UUID medicalRecordId,
        String testCode,
        String testName,
        LabOrderStatus status,
        String sampleIdentifier,
        LocalDateTime collectedAt,
        String resultValue,
        String resultUnit,
        String referenceRange,
        LocalDateTime resultedAt,
        LocalDateTime releasedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}