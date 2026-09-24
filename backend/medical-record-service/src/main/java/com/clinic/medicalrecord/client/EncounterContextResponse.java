package com.clinic.medicalrecord.client;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record EncounterContextResponse(
        UUID visitId,
        UUID appointmentId,
        UUID patientId,
        UUID doctorId,
        int queueNumber,
        String queueStatus,
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
