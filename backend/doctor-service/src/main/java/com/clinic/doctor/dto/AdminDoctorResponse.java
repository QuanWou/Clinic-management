package com.clinic.doctor.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record AdminDoctorResponse(UUID id, UUID userId, UUID specialtyId, String specialtyName,
                                  String biography, BigDecimal consultationFee, boolean active, String doctorCode) {
    public AdminDoctorResponse(UUID id, UUID userId, UUID specialtyId, String specialtyName,
                               String biography, BigDecimal consultationFee, boolean active) {
        this(id, userId, specialtyId, specialtyName, biography, consultationFee, active, null);
    }
}