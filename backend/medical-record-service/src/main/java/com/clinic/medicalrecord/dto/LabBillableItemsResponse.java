package com.clinic.medicalrecord.dto;

import java.util.List;
import java.util.UUID;

public record LabBillableItemsResponse(
        UUID appointmentId,
        List<LabBillableItemResponse> items,
        boolean finalizedForBilling,
        String billableRevision
) {
}
