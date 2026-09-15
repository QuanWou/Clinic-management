package com.clinic.patient.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record UpdatePatientRequest(
        @NotNull(message = "Date of birth is required")
        @Past(message = "Date of birth must be in the past")
        LocalDate dob,

        @NotBlank(message = "Gender is required")
        @Pattern(regexp = "(?i)^(MALE|FEMALE|OTHER)$", message = "Gender must be MALE, FEMALE, or OTHER")
        String gender,

        @Size(max = 500, message = "Address must not exceed 500 characters")
        String address,

        @Size(max = 5, message = "Blood type must not exceed 5 characters")
        @Pattern(regexp = "(?i)^(A[+-]|B[+-]|AB[+-]|O[+-])$", message = "Blood type is invalid")
        String bloodType
) {
}
