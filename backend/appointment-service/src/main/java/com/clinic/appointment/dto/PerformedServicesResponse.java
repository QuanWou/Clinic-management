package com.clinic.appointment.dto;

import java.util.List;
import java.util.UUID;

public record PerformedServicesResponse(
        UUID appointmentId,
        boolean finalized,
        String revision,
        List<PerformedServiceItemResponse> items
) {
}
