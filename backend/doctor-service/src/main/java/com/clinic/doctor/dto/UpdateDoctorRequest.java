package com.clinic.doctor.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record UpdateDoctorRequest(
        @NotNull(message = "Specialty ID is required")
        UUID specialtyId,
        @Size(max = 5000, message = "Biography must not exceed 5000 characters")
        String biography,
        @NotNull(message = "Consultation fee is required")
        @DecimalMin(value = "0.00", message = "Consultation fee must not be negative")
        @Digits(integer = 10, fraction = 2, message = "Consultation fee must have at most 10 integer digits and 2 decimal places")
        BigDecimal consultationFee
) {
}
