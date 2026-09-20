package com.clinic.billing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/** Recorded in the same transaction as cash capture; NOT a delivered notification. */
@Entity
@Table(name = "invoice_paid_outbox")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InvoicePaidOutbox {
    @Id
    private UUID eventId;
    @Column(name = "invoice_id", nullable = false, unique = true)
    private UUID invoiceId;
    @Column(name = "patient_id", nullable = false)
    private UUID patientId;
    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;
    @Column(name = "status", nullable = false, length = 40)
    private String status;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}