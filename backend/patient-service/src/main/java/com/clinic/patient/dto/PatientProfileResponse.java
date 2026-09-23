package com.clinic.patient.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record PatientProfileResponse(
        UUID id,
        UUID userId,
        LocalDate dob,
        String gender,
        String address,
        String bloodType,
        LocalDateTime updatedAt,
        String patientCode
) {
    public PatientProfileResponse(UUID id, UUID userId, LocalDate dob, String gender,
                                  String address, String bloodType, LocalDateTime updatedAt) {
        this(id, userId, dob, gender, address, bloodType, updatedAt, null);
    }
}
