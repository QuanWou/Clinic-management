package com.clinic.billing.dto;

import com.clinic.billing.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record PayInvoiceRequest(
        @NotNull(message = "Payment method is required")
        PaymentMethod paymentMethod
) {
}
