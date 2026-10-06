package com.clinic.identity.dto;

import jakarta.validation.constraints.*;

public record UpdateAdminUserRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 255) String fullName,
        @Size(max = 50) String phone
) {
}