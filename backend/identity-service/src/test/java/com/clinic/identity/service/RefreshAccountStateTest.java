package com.clinic.identity.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.RefreshTokenRequest;
import com.clinic.identity.entity.RefreshToken;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.RefreshTokenRepository;
import com.clinic.identity.repository.RoleRepository;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.JwtProperties;
import com.clinic.identity.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshAccountStateTest {
    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock RefreshTokenRepository tokens;
    @Mock PasswordEncoder encoder;
    @Mock AuthenticationManager authentication;
    @Mock JwtService jwt;

    @Test
    void lockedAccountCannotRefreshPreviouslyIssuedToken() {
        User account = new User();
        account.setId(UUID.randomUUID());
        account.setStatus(UserStatus.LOCKED);
        RefreshToken token = new RefreshToken();
        token.setToken("refresh-token");
        token.setUser(account);
        token.setRevoked(false);
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(tokens.findByTokenForUpdate("refresh-token")).thenReturn(Optional.of(token));
        when(jwt.isRefreshTokenValid("refresh-token")).thenReturn(true);
        when(jwt.extractUserId("refresh-token")).thenReturn(account.getId());
        AuthService service = new AuthService(users, roles, tokens, encoder, authentication, jwt,
                new JwtProperties("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 60, 7));

        var ex = assertThrows(BusinessException.class,
                () -> service.refresh(new RefreshTokenRequest("refresh-token")));
        assertEquals(ErrorCode.UNAUTHORIZED, ex.getErrorCode());
        verify(tokens, never()).save(any());
    }
}