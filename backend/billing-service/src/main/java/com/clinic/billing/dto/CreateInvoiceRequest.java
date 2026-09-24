package com.clinic.billing.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateInvoiceRequest(
        @NotNull(message = "Appointment ID is required")
        UUID appointmentId
) {
}
