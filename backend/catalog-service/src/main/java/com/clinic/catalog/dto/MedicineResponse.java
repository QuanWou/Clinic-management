package com.clinic.catalog.dto;

import java.util.UUID;

public record MedicineResponse(UUID id, String code, String name, String unit, String description, boolean active) {
}