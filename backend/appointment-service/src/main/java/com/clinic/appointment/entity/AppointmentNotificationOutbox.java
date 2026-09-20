package com.clinic.appointment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "appointment_notification_outbox")
@Getter
@NoArgsConstructor
public class AppointmentNotificationOutbox {
    @Id
    private UUID id;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "appointment_id", nullable = false)
    private UUID appointmentId;

    @Column(name = "recipient_user_id", nullable = false)
    private UUID recipientUserId;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "publish_attempts", nullable = false)
    private int publishAttempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "last_error", length = 255)
    private String lastError;

    public AppointmentNotificationOutbox(String eventType, UUID appointmentId, UUID recipientUserId) {
        this.id = UUID.randomUUID();
        this.eventType = eventType;
        this.appointmentId = appointmentId;
        this.recipientUserId = recipientUserId;
        this.status = "PENDING";
        this.occurredAt = LocalDateTime.now();
        this.nextAttemptAt = occurredAt;
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
