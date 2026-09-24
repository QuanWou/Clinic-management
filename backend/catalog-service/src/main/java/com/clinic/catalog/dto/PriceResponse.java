package com.clinic.catalog.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PriceResponse(UUID id, UUID serviceId, BigDecimal amount, String currency,
                            LocalDate effectiveFrom, LocalDate effectiveUntil) {
}