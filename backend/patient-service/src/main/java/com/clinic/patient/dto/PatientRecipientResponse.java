package com.clinic.patient.dto;

import java.util.UUID;

public record PatientRecipientResponse(UUID patientId, UUID userId) {}
