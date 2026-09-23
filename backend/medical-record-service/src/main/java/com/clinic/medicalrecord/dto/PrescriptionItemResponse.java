package com.clinic.medicalrecord.dto;

import java.util.UUID;

public record PrescriptionItemResponse(
        UUID id,
        UUID medicineId,
        String medicineCode,
        String medicineName,
        String medicineUnit,
        String dosage,
        String frequency,
        String duration,
        String route,
        Integer quantity,
        String note
) {
    public PrescriptionItemResponse(
            UUID id,
            String medicineName,
            String dosage,
            String frequency,
            String duration,
            String note
    ) {
        this(id, null, null, medicineName, null, dosage, frequency, duration, null, null, note);
    }
}
