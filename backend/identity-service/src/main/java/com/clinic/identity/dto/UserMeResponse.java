package com.clinic.identity.dto;

import com.clinic.identity.entity.UserStatus;

import java.util.Set;
import java.util.UUID;

public record UserMeResponse(
        UUID id,
        String email,
        String fullName,
        String phone,
        UserStatus status,
        Set<String> roles
) {
}