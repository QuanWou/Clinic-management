package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CreateLabOrderRequest(
        @NotBlank @Size(max = 100) String testCode,
        @NotBlank @Size(max = 255) String testName,
        @NotNull UUID serviceId,
        @NotNull LocalDate performedOn,
        boolean allowDuplicate,
        @Size(max = 500) String duplicateReason
) {
    public CreateLabOrderRequest(String testCode, String testName, UUID serviceId, LocalDate performedOn) {
        this(testCode, testName, serviceId, performedOn, false, null);
    }
}
