package com.clinic.medicalrecord.dto;

import com.clinic.medicalrecord.entity.MedicalRecordStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record MedicalRecordResponse(
        UUID id,
        UUID appointmentId,
        UUID patientId,
        UUID doctorId,
        String symptoms,
        String diagnosis,
        String notes,
        List<PrescriptionResponse> prescriptions,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String recordCode,
        String patientCode,
        String patientName,
        String doctorCode,
        String doctorName,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        MedicalRecordStatus status,
        Long version,
        LocalDateTime finalizedAt,
        UUID finalizedBy
) {
    public MedicalRecordResponse(
            UUID id,
            UUID appointmentId,
            UUID patientId,
            UUID doctorId,
            String symptoms,
            String diagnosis,
            String notes,
            List<PrescriptionResponse> prescriptions,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, appointmentId, patientId, doctorId, symptoms, diagnosis, notes, prescriptions,
                createdAt, updatedAt, null, null, null, null, null, null, null, null,
                MedicalRecordStatus.FINAL, 0L, updatedAt, null);
    }
}