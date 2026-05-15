package com.clinic.medicalrecord.security;

import java.util.Set;
import java.util.UUID;

public record CurrentUserPrincipal(
        UUID id,
        String email,
        String fullName,
        Set<String> roles
) {
    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }
}
