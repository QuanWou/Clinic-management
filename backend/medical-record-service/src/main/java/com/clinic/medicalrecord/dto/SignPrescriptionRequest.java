package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotNull;

public record SignPrescriptionRequest(
        @NotNull Long version
) {
}
