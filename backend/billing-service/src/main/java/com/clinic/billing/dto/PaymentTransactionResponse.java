package com.clinic.billing.dto;

import com.clinic.billing.entity.PaymentTransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record PaymentTransactionResponse(
        UUID id,
        UUID invoiceId,
        PaymentTransactionType type,
        String provider,
        String externalReference,
        BigDecimal amount,
        String currency,
        String status,
        UUID confirmedBy,
        LocalDateTime confirmedAt,
        String reason
) {
}