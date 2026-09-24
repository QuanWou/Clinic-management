package com.clinic.medicalrecord.dto;

import com.clinic.medicalrecord.entity.PrescriptionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PrescriptionResponse(
        UUID id,
        List<PrescriptionItemResponse> items,
        LocalDateTime createdAt,
        PrescriptionStatus status,
        Long version,
        LocalDateTime signedAt,
        UUID signedBy
) {
    public PrescriptionResponse(UUID id, List<PrescriptionItemResponse> items, LocalDateTime createdAt) {
        this(id, items, createdAt, PrescriptionStatus.SIGNED, 0L, createdAt, null);
    }
}
