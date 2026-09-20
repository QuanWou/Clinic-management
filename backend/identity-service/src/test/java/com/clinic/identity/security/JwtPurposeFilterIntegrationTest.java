package com.clinic.identity.security;

import com.clinic.identity.controller.AdminUserController;
import com.clinic.identity.controller.AuthController;
import com.clinic.identity.controller.UserController;
import com.clinic.identity.entity.RefreshToken;
import com.clinic.identity.entity.Role;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.RefreshTokenRepository;
import com.clinic.identity.repository.RoleRepository;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.service.AdminUserService;
import com.clinic.identity.service.AuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises the actual JwtAuthenticationFilter and Spring Security filter chain, not addFilters=false. */
@WebMvcTest(controllers = {AdminUserController.class, UserController.class, AuthController.class})
@AutoConfigureMockMvc(addFilters = true)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, AuthService.class})
@TestPropertySource(properties = {
        "app.security.jwt.secret=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
        "app.security.jwt.access-token-expiration-minutes=60",
        "app.security.jwt.refresh-token-expiration-days=7"
})
class JwtPurposeFilterIntegrationTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;

    @MockBean UserRepository users;
    @MockBean RoleRepository roles;
    @MockBean RefreshTokenRepository refreshTokens;
    @MockBean AdminUserService adminService;
    @MockBean CustomUserDetailsService userDetails;

    @Test
    void signedAdminRefreshTokenCannotAccessAdminOrMeThroughRealFilter() throws Exception {
        String refresh = jwt.generateRefreshToken(UUID.randomUUID());
        assertTrue(jwt.isRefreshTokenValid(refresh));
        assertFalse(jwt.isAccessTokenValid(refresh));

        mvc.perform(get("/api/users/admin").header("Authorization", "Bearer " + refresh))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + refresh))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(users, adminService);
    }

    @Test
    void accessTokenCannotBeUsedAsRefreshOrLogout() throws Exception {
        String access = jwt.generateAccessToken(UUID.randomUUID(), "admin@example.test", Set.of("ROLE_ADMIN"));
        assertTrue(jwt.isAccessTokenValid(access));
        assertFalse(jwt.isRefreshTokenValid(access));

        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", access))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
        mvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", access))))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(refreshTokens);
    }

    @Test
    void validAccessTokenStillGetsAdminAndMeUsingCurrentDatabaseRoles() throws Exception {
        User administrator = user(UserStatus.ACTIVE);
        String access = jwt.generateAccessToken(administrator.getId(), administrator.getEmail(), Set.of("ROLE_ADMIN"));
        assertEquals(administrator.getId(), jwt.extractUserId(access));
        when(users.findById(administrator.getId())).thenReturn(Optional.of(administrator));
        when(adminService.list(any(Pageable.class))).thenReturn(Page.empty());

        mvc.perform(get("/api/users/admin").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(administrator.getId().toString()));

        verify(adminService).list(any(Pageable.class));
    }

    @Test
    void missingTypeSubjectExpiryAndClaimsOrBadSignatureDoNotAuthenticate() throws Exception {
        UUID subject = UUID.randomUUID();
        Instant now = Instant.now();
        SecretKey key = signingKey(SECRET);
        List<String> invalid = List.of(
                signed(subject.toString(), null, now, now.plusSeconds(300), true, key),
                signed("not-a-uuid", "access", now, now.plusSeconds(300), true, key),
                signed(null, "access", now, now.plusSeconds(300), true, key),
                signed(subject.toString(), "access", now, null, true, key),
                signed(subject.toString(), "access", now, now.minusSeconds(10), true, key),
                signed(subject.toString(), "access", now, now.plusSeconds(300), false, key),
                signed(subject.toString(), "access", now, now.plusSeconds(300), true,
                        signingKey("FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210"))
        );
        for (String token : invalid) {
            assertFalse(jwt.isAccessTokenValid(token));
            mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", invalid.getFirst()))))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(users, adminService);
        verifyNoInteractions(refreshTokens);
    }

    @Test
    void lockedAdminAccessTokenCannotAccessAdminOrMe() throws Exception {
        User locked = user(UserStatus.LOCKED);
        when(users.findById(locked.getId())).thenReturn(Optional.of(locked));
        String access = jwt.generateAccessToken(locked.getId(), locked.getEmail(), Set.of("ROLE_ADMIN"));
        mvc.perform(get("/api/users/admin").header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(adminService);
    }

    @Test
    void refreshTokenWithDifferentStoredOwnerIsRejected() throws Exception {
        String refresh = jwt.generateRefreshToken(UUID.randomUUID());
        RefreshToken stored = stored(refresh, user(UserStatus.ACTIVE));
        when(refreshTokens.findByTokenForUpdate(refresh)).thenReturn(Optional.of(stored));
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", refresh))))
                .andExpect(status().isUnauthorized());
        verify(refreshTokens, never()).save(any());
    }

    @Test
    void revokedOrExpiredStoredRefreshCannotIssueNewTokens() throws Exception {
        User administrator = user(UserStatus.ACTIVE);
        String revoked = jwt.generateRefreshToken(administrator.getId());
        RefreshToken revokedRecord = stored(revoked, administrator);
        revokedRecord.setRevoked(true);
        when(refreshTokens.findByTokenForUpdate(revoked)).thenReturn(Optional.of(revokedRecord));
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", revoked))))
                .andExpect(status().isUnauthorized());

        String expired = jwt.generateRefreshToken(administrator.getId());
        RefreshToken expiredRecord = stored(expired, administrator);
        expiredRecord.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        when(refreshTokens.findByTokenForUpdate(expired)).thenReturn(Optional.of(expiredRecord));
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("refreshToken", expired))))
                .andExpect(status().isUnauthorized());
        verify(refreshTokens, never()).save(any());
    }

    @Test
    void validStoredRefreshRotatesAndCannotBeReplayed() throws Exception {
        User administrator = user(UserStatus.ACTIVE);
        String refresh = jwt.generateRefreshToken(administrator.getId());
        RefreshToken stored = stored(refresh, administrator);
        when(refreshTokens.findByTokenForUpdate(refresh)).thenReturn(Optional.of(stored));
        String body = json.writeValueAsString(java.util.Map.of("refreshToken", refresh));

        String response = mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode data = json.readTree(response).path("data");
        assertTrue(jwt.isAccessTokenValid(data.path("accessToken").asText()));
        assertTrue(jwt.isRefreshTokenValid(data.path("refreshToken").asText()));
        assertTrue(stored.getRevoked());
        assertNotEquals(refresh, data.path("refreshToken").asText());

        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        verify(refreshTokens, times(2)).save(any(RefreshToken.class));
    }

    private RefreshToken stored(String token, User user) {
        RefreshToken stored = new RefreshToken();
        stored.setId(UUID.randomUUID());
        stored.setUser(user);
        stored.setToken(token);
        stored.setRevoked(false);
        stored.setExpiresAt(LocalDateTime.now().plusDays(1));
        return stored;
    }

    private User user(UserStatus status) {
        Role role = new Role();
        role.setCode(RoleCode.ROLE_ADMIN);
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("admin@example.test");
        user.setFullName("Administrator");
        user.setStatus(status);
        user.setRoles(Set.of(role));
        return user;
    }

    private static SecretKey signingKey(String text) {
        return Keys.hmacShaKeyFor(text.getBytes(StandardCharsets.UTF_8));
    }

    private static String signed(String subject, String type, Instant issued, Instant expiry,
                                 boolean includeAccessClaims, SecretKey key) {
        var builder = Jwts.builder().issuedAt(Date.from(issued));
        if (subject != null) builder.subject(subject);
        if (type != null) builder.claim("token_type", type);
        if (expiry != null) builder.expiration(Date.from(expiry));
        if (includeAccessClaims) builder.claim("email", "admin@example.test").claim("roles", List.of("ROLE_ADMIN"));
        return builder.signWith(key).compact();
    }
}