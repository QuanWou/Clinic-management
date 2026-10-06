package com.clinic.identity.dto;

import com.clinic.identity.entity.RoleCode;
import jakarta.validation.constraints.*;

import java.util.Set;

public record CreateAdminUserRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @NotBlank @Size(max = 255) String fullName,
        @Size(max = 50) String phone,
        @NotEmpty Set<@NotNull RoleCode> roles
) {
}