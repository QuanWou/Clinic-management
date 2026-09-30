package com.clinic.appointment.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    private final JwtService jwt = new JwtService(new JwtProperties(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 30, 7));
    private final IdentityAccountClient identity = mock(IdentityAccountClient.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, identity);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(String token) throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/appointments/my");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void refreshTokenNeverAuthenticatesProtectedAppointmentRequest() throws Exception {
        authenticate(jwt.generateRefreshToken(UUID.randomUUID()));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(identity);
    }

    @Test
    void accessTokenAuthenticatesCanonicalRoleAndUserOnlyWhenIdentityConfirmsIt() throws Exception {
        UUID userId = UUID.randomUUID();
        Set<String> roles = Set.of("ROLE_DOCTOR");
        String access = jwt.generateAccessToken(userId, "doctor@example.test", roles);
        when(identity.isCurrentAccount("Bearer " + access, userId, roles)).thenReturn(true);

        authenticate(access);
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertEquals(userId, ((CurrentUserPrincipal) authentication.getPrincipal()).id());
        assertTrue(((CurrentUserPrincipal) authentication.getPrincipal()).hasRole("DOCTOR"));
        assertTrue(authentication.getAuthorities().stream().anyMatch(a -> "ROLE_DOCTOR".equals(a.getAuthority())));
    }

    @Test
    void lockedAccountCannotUsePreviouslyIssuedAccessToken() throws Exception {
        UUID userId = UUID.randomUUID();
        Set<String> roles = Set.of("ROLE_DOCTOR");
        String access = jwt.generateAccessToken(userId, "doctor@example.test", roles);
        when(identity.isCurrentAccount("Bearer " + access, userId, roles)).thenReturn(false);

        authenticate(access);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void revokedRoleOrUnavailableIdentityCannotGrantAccess() throws Exception {
        UUID userId = UUID.randomUUID();
        Set<String> roles = Set.of("ROLE_ADMIN");
        String access = jwt.generateAccessToken(userId, "admin@example.test", roles);
        // Identity rejects both role changes and temporary outages: never use stale token claims.
        authenticate(access);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(identity).isCurrentAccount("Bearer " + access, userId, roles);
    }

    @Test
    void malformedTokenFailsClosedBeforeIdentityLookup() throws Exception {
        authenticate("not-a-token");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(identity);
    }
}
