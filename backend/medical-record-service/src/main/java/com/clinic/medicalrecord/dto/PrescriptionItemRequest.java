package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PrescriptionItemRequest(
        @NotBlank(message = "Medicine name is required")
        @Size(max = 255, message = "Medicine name cannot exceed 255 characters")
        String medicineName,

        @NotBlank(message = "Dosage is required")
        @Size(max = 100, message = "Dosage cannot exceed 100 characters")
        String dosage,

        @NotBlank(message = "Frequency is required")
        @Size(max = 100, message = "Frequency cannot exceed 100 characters")
        String frequency,

        @NotBlank(message = "Duration is required")
        @Size(max = 100, message = "Duration cannot exceed 100 characters")
        String duration,

        @Size(max = 500, message = "Note cannot exceed 500 characters")
        String note
) {
}
