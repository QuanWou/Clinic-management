package com.clinic.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CashPaymentRequest(
        @NotBlank @Size(max = 100)
        @Pattern(regexp = "[A-Za-z0-9_-]+", message = "Receipt reference must be alphanumeric with dashes or underscores")
        String receiptReference
) {
}