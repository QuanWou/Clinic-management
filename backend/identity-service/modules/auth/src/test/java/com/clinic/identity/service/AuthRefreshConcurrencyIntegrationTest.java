package com.clinic.identity.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.RefreshTokenRequest;
import com.clinic.identity.entity.RefreshToken;
import com.clinic.identity.entity.RoleCode;
import com.clinic.identity.entity.User;
import com.clinic.identity.entity.UserStatus;
import com.clinic.identity.repository.RefreshTokenRepository;
import com.clinic.identity.repository.RoleRepository;
import com.clinic.identity.repository.UserRepository;
import com.clinic.identity.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Uses the isolated clinic_security_test DB only, and never the clinic_db application database. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/clinic_security_test?currentSchema=identity",
        "spring.datasource.username=postgres",
        "spring.datasource.password=password",
        "spring.jpa.properties.hibernate.default_schema=identity",
        "spring.flyway.schemas=identity",
        "spring.flyway.default-schema=identity"
})
@EnabledIfEnvironmentVariable(named = "CLINIC_SECURITY_TEST_DB", matches = "true")
class AuthRefreshConcurrencyIntegrationTest {
    @Autowired AuthService auth;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired RefreshTokenRepository tokens;
    @Autowired JdbcTemplate jdbc;

    private UUID createdUserId;

    @AfterEach
    void cleanupOnlyCreatedTestUser() {
        if (createdUserId != null) {
            jdbc.update("DELETE FROM identity.refresh_tokens WHERE user_id = ?", createdUserId);
            jdbc.update("DELETE FROM identity.user_roles WHERE user_id = ?", createdUserId);
            jdbc.update("DELETE FROM identity.users WHERE id = ?", createdUserId);
        }
    }

    @Test
    void concurrentRefreshRequestsCannotReuseSameRefreshToken() throws Exception {
        User user = new User();
        createdUserId = UUID.randomUUID();
        user.setId(createdUserId);
        user.setEmail("security-" + createdUserId + "@example.test");
        user.setPasswordHash("unused-test-password-hash");
        user.setFullName("Refresh Test");
        user.setStatus(UserStatus.ACTIVE);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setRoles(Set.of(roles.findByCode(RoleCode.ROLE_PATIENT).orElseThrow()));
        users.saveAndFlush(user);

        String original = jwt.generateRefreshToken(createdUserId);
        RefreshToken stored = new RefreshToken();
        stored.setId(UUID.randomUUID());
        stored.setUser(user);
        stored.setToken(original);
        stored.setExpiresAt(LocalDateTime.now().plusDays(1));
        stored.setCreatedAt(LocalDateTime.now());
        stored.setRevoked(false);
        tokens.saveAndFlush(stored);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            Future<String> one = workers.submit(() -> refreshAtOnce(original, ready, start));
            Future<String> two = workers.submit(() -> refreshAtOnce(original, ready, start));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(Set.of("ROTATED", "REJECTED"), Set.of(
                    one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)));
        }
        assertTrue(tokens.findByToken(original).orElseThrow().getRevoked());
        Integer active = jdbc.queryForObject(
                "SELECT count(*) FROM identity.refresh_tokens WHERE user_id=? AND revoked=false",
                Integer.class, createdUserId);
        assertEquals(1, active);
    }

    private String refreshAtOnce(String token, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent refresh did not start");
        }
        try {
            var result = auth.refresh(new RefreshTokenRequest(token));
            assertTrue(jwt.isAccessTokenValid(result.accessToken()));
            return "ROTATED";
        } catch (BusinessException ex) {
            if (ErrorCode.UNAUTHORIZED.equals(ex.getErrorCode())) {
                return "REJECTED";
            }
            throw ex;
        }
    }
}
