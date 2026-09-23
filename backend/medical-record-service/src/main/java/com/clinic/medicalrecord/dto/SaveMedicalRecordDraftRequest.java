package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.Size;

public record SaveMedicalRecordDraftRequest(
        @Size(max = 4000, message = "Symptoms cannot exceed 4000 characters")
        String symptoms,

        @Size(max = 4000, message = "Diagnosis cannot exceed 4000 characters")
        String diagnosis,

        @Size(max = 4000, message = "Notes cannot exceed 4000 characters")
        String notes,

        Long version
) {
}
