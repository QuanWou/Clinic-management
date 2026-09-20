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

    public LabEventOutbox(UUID labOrderId, UUID appointmentId, LocalDateTime occurredAt) {
        this.id = UUID.randomUUID();
        this.eventType = RESULT_READY;
        this.labOrderId = labOrderId;
        this.appointmentId = appointmentId;
        this.occurredAt = occurredAt;
    }

    public LabResultReadyEvent toEvent() {
        return new LabResultReadyEvent(id, eventType, labOrderId, appointmentId, occurredAt);
    }
}