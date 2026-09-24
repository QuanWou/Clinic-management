package com.clinic.doctor.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.UUID;

public record UpdateAdminDoctorRequest(
        @NotNull UUID specialtyId,
        @Size(max = 10000) String biography,
        @NotNull @DecimalMin(value = "0.00") @Digits(integer = 10, fraction = 2) BigDecimal consultationFee,
        @NotNull Boolean active
) {
}