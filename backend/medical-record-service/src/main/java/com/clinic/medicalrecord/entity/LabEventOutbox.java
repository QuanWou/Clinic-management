package com.clinic.medicalrecord.entity;

import com.clinic.medicalrecord.dto.LabResultReadyEvent;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/** Durable event intent inserted in the exact same transaction as result release. */
@Entity
@Table(name = "lab_event_outbox")
@Getter
@NoArgsConstructor
public class LabEventOutbox {
    public static final String RESULT_READY = "LAB_RESULT_READY";

    @Id
    private UUID id;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "lab_order_id", nullable = false, unique = true)
    private UUID labOrderId;

    @Column(name = "appointment_id", nullable = false)
    private UUID appointmentId;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "publish_attempts", nullable = false)
    private int publishAttempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "last_error", length = 255)
    private String lastError;

    public LabEventOutbox(UUID labOrderId, UUID appointmentId, UUID recipientUserId, LocalDateTime occurredAt) {
        this.id = UUID.randomUUID();
        this.eventType = RESULT_READY;
        this.labOrderId = labOrderId;
        this.appointmentId = appointmentId;
        this.recipientUserId = recipientUserId;
        this.occurredAt = occurredAt;
        this.nextAttemptAt = occurredAt;
    }

    public LabResultReadyEvent toEvent() {
        return new LabResultReadyEvent(id, eventType, labOrderId, appointmentId, occurredAt);
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
