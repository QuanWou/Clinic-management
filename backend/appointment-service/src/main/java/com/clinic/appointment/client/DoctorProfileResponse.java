package com.clinic.appointment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DoctorProfileResponse(UUID id, UUID userId) {
}