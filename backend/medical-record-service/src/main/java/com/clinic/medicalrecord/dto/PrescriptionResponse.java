package com.clinic.medicalrecord.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PrescriptionResponse(
        UUID id,
        List<PrescriptionItemResponse> items,
        LocalDateTime createdAt
) {
}
