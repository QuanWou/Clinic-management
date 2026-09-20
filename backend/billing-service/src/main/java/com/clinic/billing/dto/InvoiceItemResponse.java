package com.clinic.billing.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record InvoiceItemResponse(UUID id, String sourceType, UUID sourceId, UUID serviceId,
                                  String serviceCode, String serviceName, UUID priceId,
                                  LocalDate serviceDate, BigDecimal unitPrice, int quantity,
                                  BigDecimal lineAmount, String currency) {}