package com.clinic.patient.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record RegisterWalkInPatientRequest(
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Pattern(regexp = "^[+0-9() .-]{7,20}$") String phone,
        @Past LocalDate dob,
        @Size(max = 10) String gender,
        @Size(max = 255) String address,
        @Size(max = 5) String bloodType
) {
}