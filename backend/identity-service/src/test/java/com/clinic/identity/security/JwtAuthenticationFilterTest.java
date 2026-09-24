package com.clinic.identity.security;

import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.UserRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    private final JwtService jwt = new JwtService(new JwtProperties(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 30, 7));
    private final UserRepository users = mock(UserRepository.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/me");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @Test
    void refreshTokenCannotAuthenticateEvenWhenItHasValidSignature() throws Exception {
        authenticate(jwt.generateRefreshToken(UUID.randomUUID()));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(users);
    }

    @Test
    void lockedUserCannotAuthenticateWithPreviouslyIssuedAccessToken() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = user(userId, UserStatus.LOCKED);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        authenticate(jwt.generateAccessToken(userId, user.getEmail(), Set.of("ROLE_PATIENT")));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void activeUserGetsCurrentRolesFromDatabase() throws Exception {
        UUID userId = UUID.randomUUID();
        User user = user(userId, UserStatus.ACTIVE);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        authenticate(jwt.generateAccessToken(userId, user.getEmail(), Set.of("ROLE_DOCTOR")));
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertEquals(userId, ((CurrentUserPrincipal) authentication.getPrincipal()).id());
        assertTrue(authentication.getAuthorities().stream().anyMatch(a -> "ROLE_PATIENT".equals(a.getAuthority())));
        assertFalse(authentication.getAuthorities().stream().anyMatch(a -> "ROLE_DOCTOR".equals(a.getAuthority())));
    }

    private User user(UUID id, UserStatus status) {
        User user = new User();
        user.setId(id);
        user.setStatus(status);
        user.setEmail("patient@example.test");
        user.setFullName("Patient");
        Role role = new Role();
        role.setCode(RoleCode.ROLE_PATIENT);
        user.setRoles(Set.of(role));
        return user;
    }
}
