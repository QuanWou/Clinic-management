package com.clinic.patient.dto;

import jakarta.validation.constraints.Past;
import java.time.LocalDate;

public record UpdatePatientRequest(
        @Past(message = "Date of birth must be in the past")
        LocalDate dob,
        String gender,
        String address,
        String bloodType
) {
}
