package com.clinic.billing.security;

import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CurrentUserPrincipalTest {
    @Test
    void patientJwtIsRecognizedWithoutGrantingBillingStaffAccess() {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(UUID.randomUUID(), "patient@example.com", "Patient", Set.of("ROLE_PATIENT"));

        assertThat(principal.hasRole("PATIENT")).isTrue();
        assertThat(principal.hasRole("ADMIN")).isFalse();
        assertThat(principal.hasRole("RECEPTIONIST")).isFalse();
    }
}