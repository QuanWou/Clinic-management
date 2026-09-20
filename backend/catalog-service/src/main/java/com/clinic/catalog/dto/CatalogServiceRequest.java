package com.clinic.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CatalogServiceRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,60}") String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 1000) String description,
        @NotNull Boolean active
) {
}