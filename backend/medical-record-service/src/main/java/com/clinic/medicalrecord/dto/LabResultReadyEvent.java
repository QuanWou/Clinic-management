package com.clinic.medicalrecord.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/** Internal notification contract: identifiers only; no clinical findings or contact data. */
public record LabResultReadyEvent(
        UUID eventId,
        String eventType,
        UUID orderId,
        UUID appointmentId,
        LocalDateTime occurredAt
) {
}