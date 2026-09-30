package com.clinic.appointment.dto;

import java.time.LocalDate;
import java.util.UUID;

public record PerformedServiceItemResponse(
        UUID performedItemId,
        UUID serviceId,
        int quantity,
        LocalDate serviceDate
) {
}
