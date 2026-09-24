package com.clinic.doctor.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Size;

/** Only self-service fields belong here; administrative fields are never accepted. */
public record UpdateDoctorProfileRequest(
        @Size(max = 10000) String biography
) {
    @JsonAnySetter
    public void rejectUnknownField(String name, Object value) {
        throw new IllegalArgumentException("Unsupported doctor profile field: " + name);
    }
}