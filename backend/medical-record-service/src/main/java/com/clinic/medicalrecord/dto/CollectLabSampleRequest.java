package com.clinic.medicalrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollectLabSampleRequest(@NotBlank @Size(max = 100) String sampleIdentifier) {
}