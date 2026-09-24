package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecordLabResultRequest(
        @NotBlank @Size(max = 4000) String value,
        @Size(max = 100) String unit,
        @Size(max = 255) String referenceRange
) {
}