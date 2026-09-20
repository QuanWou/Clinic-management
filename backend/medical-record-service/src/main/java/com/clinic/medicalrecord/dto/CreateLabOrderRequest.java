package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateLabOrderRequest(
        @NotBlank @Size(max = 100) String testCode,
        @NotBlank @Size(max = 255) String testName
) {
}