package com.clinic.identity.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequest(
        @NotBlank
        String refreshToken
) {
}