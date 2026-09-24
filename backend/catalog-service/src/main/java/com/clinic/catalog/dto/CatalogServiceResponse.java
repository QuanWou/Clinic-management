package com.clinic.catalog.dto;

import java.util.UUID;

public record CatalogServiceResponse(UUID id, String code, String name, String description, boolean active) {
}