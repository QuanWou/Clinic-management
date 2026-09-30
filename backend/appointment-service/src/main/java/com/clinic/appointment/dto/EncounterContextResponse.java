package com.clinic.appointment.dto;

import com.clinic.appointment.entity.QueueStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record EncounterContextResponse(
        UUID visitId,
        UUID appointmentId,
        UUID patientId,
        UUID doctorId,
        int queueNumber,
        QueueStatus queueStatus,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        String reason,
        PatientSummary patient
) {
    public record PatientSummary(
            UUID id,
            String fullName,
            LocalDate dob,
            String gender,
            String bloodType
    ) {
    }
}
