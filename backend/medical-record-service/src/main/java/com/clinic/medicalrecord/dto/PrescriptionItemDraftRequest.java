package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record PrescriptionItemDraftRequest(
        @NotNull UUID medicineId,
        @NotBlank @Size(max = 100) String dosage,
        @NotBlank @Size(max = 100) String frequency,
        @NotBlank @Size(max = 100) String duration,
        @Size(max = 100) String route,
        @Positive @Max(100000) Integer quantity,
        @Size(max = 500) String note
) {
}
