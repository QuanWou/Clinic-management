package com.clinic.appointment.dto;

import com.clinic.appointment.entity.QueueStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record ReceptionVisitResponse(
        UUID id,
        UUID appointmentId,
        UUID patientId,
        UUID doctorId,
        LocalDate visitDate,
        int queueNumber,
        QueueStatus status,
        LocalDateTime checkedInAt,
        LocalDateTime startedAt,
        LocalDateTime completedAt
) {
}