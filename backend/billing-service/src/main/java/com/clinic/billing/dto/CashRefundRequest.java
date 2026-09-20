package com.clinic.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CashRefundRequest(
        @NotBlank @Size(max = 100)
        @Pattern(regexp = "[A-Za-z0-9_-]+", message = "Refund reference must be alphanumeric with dashes or underscores")
        String refundReference,
        @NotBlank @Size(max = 500) String reason
) {
}