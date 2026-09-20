package com.clinic.medicalrecord.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Executes the real JWT filter with signed tokens matching identity-service's roles claim. */
class JwtAuthenticationFilterTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    private final JwtService jwt = new JwtService(new JwtProperties(SECRET, 60, 7));
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void acceptsActualRoleDoctorAccessToken() throws Exception {
        var authentication = authenticate(jwt.generateAccessToken(UUID.randomUUID(), "doctor@test.com", Set.of("ROLE_DOCTOR")));
        assertTrue(authentication instanceof CurrentUserPrincipal);
        CurrentUserPrincipal principal = (CurrentUserPrincipal) authentication;
        assertTrue(principal.hasRole("DOCTOR"));
        assertFalse(principal.hasRole("ADMIN"));
        assertEquals("ROLE_DOCTOR", SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().iterator().next().getAuthority());
    }

    @Test
    void patientCannotAcquireDoctorPermission() throws Exception {
        CurrentUserPrincipal principal = (CurrentUserPrincipal) authenticate(
                jwt.generateAccessToken(UUID.randomUUID(), "patient@test.com", Set.of("ROLE_PATIENT")));
        assertFalse(principal.hasRole("DOCTOR"));
        assertTrue(principal.hasRole("PATIENT"));
    }

    @Test
    void refreshTokenWithoutEmailAndRolesCannotAuthenticateMedicalService() throws Exception {
        String refresh = Jwts.builder().subject(UUID.randomUUID().toString())
                .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertNull(authenticate(refresh));
    }

    @Test
    void signedAccessTokenWithWrongRoleFormatCannotAuthenticate() throws Exception {
        assertNull(authenticate(jwt.generateAccessToken(UUID.randomUUID(), "doctor@test.com", Set.of("DOCTOR"))));
    }

    @Test
    void malformedUserIdCannotAuthenticate() throws Exception {
        String token = Jwts.builder().subject("not-a-uuid")
                .claim("email", "doctor@test.com").claim("roles", Set.of("ROLE_DOCTOR"))
                .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertNull(authenticate(token));
    }

    private Object authenticate(String token) throws ServletException, IOException {
        SecurityContextHolder.clearContext();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/medical-records/my");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<Object> principal = new AtomicReference<>();
        filter.doFilter(request, response, (req, res) -> {
            if (SecurityContextHolder.getContext().getAuthentication() != null) {
                principal.set(SecurityContextHolder.getContext().getAuthentication().getPrincipal());
            }
        });
        return principal.get();
    }
}