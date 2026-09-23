package com.clinic.identity.dto;

import java.util.UUID;

/** Minimal, role-scoped account projection for appointment doctor selection. */
public record DoctorNameResponse(UUID id, String fullName) {}