package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotNull;

public record FinalizeMedicalRecordRequest(
        @NotNull(message = "Record version is required")
        Long version
) {
}
