package com.clinic.identity.dto;

import java.util.Set;
import java.util.UUID;

public record AuthResponse(
        UUID userId,
        String email,
        String fullName,
        Set<String> roles,
        String accessToken,
        String refreshToken,
        String accountCode
) {
    public AuthResponse(UUID userId, String email, String fullName, Set<String> roles,
                        String accessToken, String refreshToken) {
        this(userId, email, fullName, roles, accessToken, refreshToken, null);
    }
}