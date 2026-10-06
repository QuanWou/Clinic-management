package com.clinic.identity.security;

import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountStateSecurityTest {
    @Mock JwtService jwt;
    @Mock UserRepository users;

    @AfterEach
    void cleanSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void lockedAccountCannotAuthenticateEvenWithValidAccessJwt() throws Exception {
        UUID id = UUID.randomUUID();
        when(jwt.isAccessTokenValid("signed-token")).thenReturn(true);
        when(jwt.extractUserId("signed-token")).thenReturn(id);
        when(users.findById(id)).thenReturn(Optional.of(user(id, UserStatus.LOCKED)));
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer signed-token");

        new JwtAuthenticationFilter(jwt, users).doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void activeAccountUsesCurrentDatabaseRoles() throws Exception {
        UUID id = UUID.randomUUID();
        when(jwt.isAccessTokenValid("signed-token")).thenReturn(true);
        when(jwt.extractUserId("signed-token")).thenReturn(id);
        when(users.findById(id)).thenReturn(Optional.of(user(id, UserStatus.ACTIVE)));
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer signed-token");

        new JwtAuthenticationFilter(jwt, users).doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_PATIENT".equals(authority.getAuthority())));
        assertFalse(authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())));
    }

    @Test
    void inactiveAndLockedAccountsCannotLoginWithPassword() {
        User inactive = user(UUID.randomUUID(), UserStatus.INACTIVE);
        when(users.findByEmail(inactive.getEmail())).thenReturn(Optional.of(inactive));
        assertFalse(new CustomUserDetailsService(users).loadUserByUsername(inactive.getEmail()).isEnabled());

        User locked = user(UUID.randomUUID(), UserStatus.LOCKED);
        when(users.findByEmail(locked.getEmail())).thenReturn(Optional.of(locked));
        assertFalse(new CustomUserDetailsService(users).loadUserByUsername(locked.getEmail()).isAccountNonLocked());
    }

    private User user(UUID id, UserStatus status) {
        Role role = new Role();
        role.setCode(RoleCode.ROLE_PATIENT);
        User user = new User();
        user.setId(id);
        user.setEmail("patient@example.test");
        user.setPasswordHash("hashed-password");
        user.setFullName("Patient");
        user.setStatus(status);
        user.setRoles(Set.of(role));
        return user;
    }
}