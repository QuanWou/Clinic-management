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
    @Column(name = "recipient_user_id")
    private UUID recipientUserId;
    @Column(name = "publish_attempts", nullable = false)
    @Builder.Default
    private int publishAttempts = 0;
    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;
    @Column(name = "published_at")
    private LocalDateTime publishedAt;
    @Column(name = "last_error", length = 255)
    private String lastError;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public void recipientResolved(UUID userId) {
        recipientUserId = java.util.Objects.requireNonNull(userId);
        status = "PENDING";
        nextAttemptAt = LocalDateTime.now();
        lastError = null;
    }

    public void skippedNoAccount() {
        status = "SKIPPED_NO_ACCOUNT";
        lastError = null;
    }

    public void published() {
        status = "PUBLISHED";
        publishedAt = LocalDateTime.now();
        lastError = null;
    }

    public void failed(String error) {
        publishAttempts++;
        lastError = error == null ? "Publish failed" : error.substring(0, Math.min(255, error.length()));
        if (publishAttempts >= 5) status = "FAILED";
        else nextAttemptAt = LocalDateTime.now().plusSeconds(15L * (1L << (publishAttempts - 1)));
    }
}
