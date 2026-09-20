package com.clinic.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    private UUID id;

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "event_type", length = 64)
    private String eventType;

    @Column(nullable = false)
    private String recipient;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationStatus status;

    private Instant sentAt;

    private Instant readAt;

    @Builder.Default
    @Column(nullable = false)
    private int deliveryAttempts = 0;

    @Builder.Default
    @Column(nullable = false)
    private int publishFailures = 0;

    @Column(nullable = false)
    private Instant nextAttemptAt;

    private Instant lastEnqueuedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
