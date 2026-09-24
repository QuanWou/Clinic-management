package com.clinic.appointment.client;

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
        LocalDateTime updatedAt
) {
}
