package com.clinic.medicalrecord.dto;

import java.util.UUID;

public record PrescriptionItemResponse(
        UUID id,
        String medicineName,
        String dosage,
        String frequency,
        String duration,
        String note
) {
}
