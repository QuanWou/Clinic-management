package com.clinic.notification.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.notification.dto.NotificationPreferenceResponse;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.security.JwtProperties;
import com.clinic.notification.security.JwtService;
import com.clinic.notification.security.SecurityConfig;
import com.clinic.notification.service.NotificationPreferenceService;
import com.clinic.notification.service.NotificationService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises the actual bearer-token filter and method security, not addFilters=false. */
@WebMvcTest(NotificationController.class)
@Import({SecurityConfig.class, JwtService.class})
@EnableConfigurationProperties(JwtProperties.class)
@TestPropertySource(properties = "app.security.jwt.secret=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF")
class NotificationControllerSecurityTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    @Autowired MockMvc mvc;
    @MockBean NotificationService service;
    @MockBean NotificationPreferenceService preferences;

    private String token(UUID userId, String role) {
        return "Bearer " + Jwts.builder().subject(userId.toString())
                .claim("email", "user@example.com").claim("roles", List.of(role))
                .claim("token_type", "access")
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test
    void unauthenticatedAndRefreshTokensAreRejected() throws Exception {
        mvc.perform(get("/api/notifications/my")).andExpect(status().isUnauthorized());
        String refresh = "Bearer " + Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("email", "user@example.com").claim("roles", List.of("ROLE_PATIENT"))
                .claim("token_type", "refresh")
                .expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        mvc.perform(get("/api/notifications/my").header("Authorization", refresh))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notifications/my").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service, preferences);
    }

    @Test
    void patientAndDoctorCannotListOrSendEveryoneNotifications() throws Exception {
        for (String role : List.of("ROLE_PATIENT", "ROLE_DOCTOR")) {
            UUID user = UUID.randomUUID();
            mvc.perform(get("/api/notifications").header("Authorization", token(user, role)))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/notifications").header("Authorization", token(user, role))
                    .contentType("application/json")
                    .content("{\"recipient\":\"in-app\",\"subject\":\"Test\",\"content\":\"Test\",\"type\":\"IN_APP\",\"recipientUserId\":\"" + user + "\"}"))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service, preferences);
    }

    @Test
    void actualJwtSubjectControlsInboxReadStateAndPreferences() throws Exception {
        UUID user = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID notification = UUID.randomUUID();
        when(service.getMine(user)).thenReturn(List.of());
        when(preferences.mine(user)).thenReturn(List.of(new NotificationPreferenceResponse(NotificationType.IN_APP, true)));
        when(preferences.update(user, NotificationType.EMAIL, true))
                .thenReturn(new NotificationPreferenceResponse(NotificationType.EMAIL, true));
        mvc.perform(get("/api/notifications/my?userId=" + other)
                .header("Authorization", token(user, "ROLE_PATIENT")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/notifications/my/preferences")
                .header("Authorization", token(user, "ROLE_PATIENT")))
                .andExpect(status().isOk());
        mvc.perform(put("/api/notifications/my/preferences/EMAIL")
                .header("Authorization", token(user, "ROLE_PATIENT"))
                .contentType("application/json").content("{\"enabled\":true}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/notifications/" + notification + "/read")
                .header("Authorization", token(user, "ROLE_PATIENT")))
                .andExpect(status().isOk());
        verify(service).getMine(user);
        verify(service).markRead(notification, user);
        verify(preferences).mine(user);
        verify(preferences).update(user, NotificationType.EMAIL, true);
        verify(service, never()).getMine(other);
    }

    @Test
    void requesterWithoutOwnershipGetsNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        UUID user = UUID.randomUUID();
        when(service.getById(eq(id), argThat(principal -> principal.id().equals(user))))
                .thenThrow(new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Notification not found"));
        mvc.perform(get("/api/notifications/" + id)
                .header("Authorization", token(user, "ROLE_PATIENT")))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminAndReceptionistCanListWithRealRoleAuthorities() throws Exception {
        for (String role : List.of("ROLE_ADMIN", "ROLE_RECEPTIONIST")) {
            mvc.perform(get("/api/notifications")
                    .header("Authorization", token(UUID.randomUUID(), role)))
                    .andExpect(status().isOk());
        }
        verify(service, times(2)).getAll();
    }
}
