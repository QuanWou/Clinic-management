package com.clinic.billing.dto;

import com.clinic.billing.entity.InvoiceStatus;
import com.clinic.billing.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record InvoiceResponse(
        UUID id,
        UUID patientId,
        UUID appointmentId,
        BigDecimal totalAmount,
        InvoiceStatus status,
        PaymentMethod paymentMethod,
        LocalDateTime paidAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
