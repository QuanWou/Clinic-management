package com.clinic.medicalrecord.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateMedicalRecordRequest(
        @NotNull(message = "Appointment ID is required")
        UUID appointmentId,

        @Size(max = 4000, message = "Symptoms cannot exceed 4000 characters")
        String symptoms,

        @NotBlank(message = "Diagnosis is required")
        @Size(max = 4000, message = "Diagnosis cannot exceed 4000 characters")
        String diagnosis,

        @Size(max = 4000, message = "Notes cannot exceed 4000 characters")
        String notes,

        @Valid
        List<PrescriptionItemRequest> prescriptionItems
) {
}
