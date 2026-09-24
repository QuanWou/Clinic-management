package com.clinic.patient.dto;

import java.time.LocalDate;
import java.util.UUID;

public record ReceptionPatientResponse(
        UUID id,
        UUID userId,
        String fullName,
        String phone,
        LocalDate dob,
        String gender,
        String address,
        String bloodType,
        String patientCode
) {
    public ReceptionPatientResponse(UUID id, UUID userId, String fullName, String phone,
                                    LocalDate dob, String gender, String address, String bloodType) {
        this(id, userId, fullName, phone, dob, gender, address, bloodType, null);
    }
}