package com.clinic.appointment.dto;

import java.util.UUID;

public record BusinessNotificationEvent(
        int version,
        UUID eventId,
        String eventType,
        UUID aggregateId,
        UUID recipientUserId,
        String channel
) {}
