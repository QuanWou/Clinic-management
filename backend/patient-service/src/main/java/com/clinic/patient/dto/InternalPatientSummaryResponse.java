package com.clinic.patient.dto;

import java.time.LocalDate;
import java.util.UUID;

public record InternalPatientSummaryResponse(
        UUID patientId,
        String fullName,
        LocalDate dob,
        String gender,
        String bloodType
) {
}
