package com.clinic.medicalrecord.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/** Append-only audit metadata. Clinical contents and bearer tokens must never be stored here. */
@Entity
@Table(name = "medical_audit_events")
@Getter
@NoArgsConstructor
public class MedicalAuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public MedicalAuditEvent(UUID actorUserId, String action, UUID resourceId) {
        this.actorUserId = actorUserId;
        this.action = action;
        this.resourceId = resourceId;
    }
}