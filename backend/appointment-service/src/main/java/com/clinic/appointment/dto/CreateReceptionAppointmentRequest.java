package com.clinic.appointment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record CreateReceptionAppointmentRequest(
        @NotNull UUID patientId,
        @NotNull UUID doctorId,
        @NotNull LocalDate appointmentDate,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotBlank @Size(max = 500) String reason
) {
}