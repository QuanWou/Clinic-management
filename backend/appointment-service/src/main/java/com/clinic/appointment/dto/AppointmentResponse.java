package com.clinic.appointment.dto;

import com.clinic.appointment.entity.AppointmentStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.UUID;

public record AppointmentResponse(
        UUID id,
        UUID patientId,
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
