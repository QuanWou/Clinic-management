package com.clinic.doctor.dto;

import java.util.UUID;

public record SpecialtyResponse(
        UUID id,
        String name,
        String description
) {
}
