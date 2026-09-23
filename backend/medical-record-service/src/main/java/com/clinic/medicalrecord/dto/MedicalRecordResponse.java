package com.clinic.medicalrecord.dto;

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
        LocalTime endTime
) {
}
