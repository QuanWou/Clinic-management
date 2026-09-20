package com.clinic.identity.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.RefreshTokenRequest;
import com.clinic.identity.entity.RefreshToken;
import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.RefreshTokenRepository;
import com.clinic.identity.repository.RoleRepository;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.JwtProperties;
import com.clinic.identity.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRefreshTest {
    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock RefreshTokenRepository tokens;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuthenticationManager authenticationManager;

    private final JwtProperties properties = new JwtProperties(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 30, 7);
    private final JwtService jwt = new JwtService(properties);
    private AuthService service;
    private User user;
    private RefreshToken stored;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, roles, tokens, passwordEncoder, authenticationManager, jwt, properties);
        user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("patient@example.test");
        user.setFullName("Patient");
        user.setStatus(UserStatus.ACTIVE);
        Role role = new Role();
        role.setCode(RoleCode.ROLE_PATIENT);
        user.setRoles(Set.of(role));

        stored = new RefreshToken();
        stored.setId(UUID.randomUUID());
        stored.setUser(user);
        stored.setToken(jwt.generateRefreshToken(user.getId()));
        stored.setExpiresAt(LocalDateTime.now().plusDays(1));
        stored.setRevoked(false);
    }

    @Test
    void refreshRotatesTokenAndRevokesPreviousValue() {
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        var response = service.refresh(new RefreshTokenRequest(stored.getToken()));
        assertTrue(stored.getRevoked());
        assertEquals(user.getId(), jwt.extractUserId(response.accessToken()));
        assertTrue(jwt.isAccessTokenValid(response.accessToken()));
        assertTrue(jwt.isRefreshTokenValid(response.refreshToken()));
        assertNotEquals(stored.getToken(), response.refreshToken());
        verify(tokens).save(stored);
    }

    @Test
    void revokedTokenCannotBeRefreshedAgain() {
        stored.setRevoked(true);
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.refresh(new RefreshTokenRequest(stored.getToken())));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }

    @Test
    void accessTokenCannotBeUsedAsRefreshTokenEvenIfPersisted() {
        stored.setToken(jwt.generateAccessToken(user.getId(), user.getEmail(), Set.of("ROLE_PATIENT")));
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.refresh(new RefreshTokenRequest(stored.getToken())));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }

    @Test
    void accessTokenCannotBeUsedForLogoutEvenIfPersisted() {
        String access = jwt.generateAccessToken(user.getId(), user.getEmail(), Set.of("ROLE_PATIENT"));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.logout(new RefreshTokenRequest(access)));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).findByTokenForUpdate(any());
        verify(tokens, never()).save(any());
    }

    @Test
    void refreshTokenCannotLogOutDifferentUsersTokenRow() {
        stored.setToken(jwt.generateRefreshToken(UUID.randomUUID()));
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.logout(new RefreshTokenRequest(stored.getToken())));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }

    @Test
    void refreshTokenCannotBeUsedForDifferentUser() {
        stored.setToken(jwt.generateRefreshToken(UUID.randomUUID()));
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.refresh(new RefreshTokenRequest(stored.getToken())));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }

    @Test
    void lockedAccountCannotReceiveFreshAccessToken() {
        user.setStatus(UserStatus.LOCKED);
        when(tokens.findByTokenForUpdate(stored.getToken())).thenReturn(Optional.of(stored));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.refresh(new RefreshTokenRequest(stored.getToken())));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }
}
