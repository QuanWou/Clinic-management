package com.clinic.appointment.dto;

import com.clinic.appointment.entity.AppointmentStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/** Reception-only appointment projection enriched with a verified patient display name. */
public record ReceptionAppointmentResponse(
        UUID id,
        UUID patientId,
        String patientName,
        UUID doctorId,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        AppointmentStatus status,
        String reason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}