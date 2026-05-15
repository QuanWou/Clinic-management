package com.clinic.medicalrecord.client;

import java.math.BigDecimal;
import java.util.UUID;

public record DoctorProfileResponse(
        UUID id,
        UUID userId,
        UUID specialtyId,
        String specialtyName,
        String biography,
        BigDecimal consultationFee
) {
}
