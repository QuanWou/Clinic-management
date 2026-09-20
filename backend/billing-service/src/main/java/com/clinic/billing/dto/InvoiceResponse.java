package com.clinic.billing.dto;

import com.clinic.billing.entity.InvoiceStatus;
import com.clinic.billing.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;

public record InvoiceResponse(
        UUID id,
        UUID patientId,
        UUID appointmentId,
        BigDecimal totalAmount,
        String catalogRevision,
        String currency,
        List<InvoiceItemResponse> items,
        InvoiceStatus status,
        PaymentMethod paymentMethod,
        LocalDateTime paidAt,
        UUID paidBy,
        LocalDateTime refundedAt,
        UUID refundedBy,
        LocalDateTime cancelledAt,
        UUID cancelledBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
