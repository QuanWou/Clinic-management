package com.clinic.appointment.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record AddPerformedServiceRequest(
        @NotNull UUID serviceId,
        @Min(1) int quantity,
        @NotNull LocalDate serviceDate
) {
}
