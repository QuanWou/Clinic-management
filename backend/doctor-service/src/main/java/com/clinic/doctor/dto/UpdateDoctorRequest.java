package com.clinic.doctor.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record UpdateDoctorRequest(
        @NotNull(message = "Specialty ID is required")
        UUID specialtyId,
        String biography,
        @NotNull(message = "Consultation fee is required")
        @Min(value = 0, message = "Consultation fee must be positive")
        BigDecimal consultationFee
) {
}
