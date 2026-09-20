package com.clinic.medicalrecord.dto;

import com.clinic.medicalrecord.entity.LabOrderStatus;

import java.time.LocalDateTime;
import java.util.UUID;

/** Minimal billing contract: no clinical values, specimen identifiers or patient details. */
public record LabBillableItemResponse(
        UUID orderId,
        String testCode,
        int quantity,
        LabOrderStatus status,
        LocalDateTime billableAt
) {
}