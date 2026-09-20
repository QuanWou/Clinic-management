package com.clinic.appointment.controller;

import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.security.IdentityAccountClient;
import com.clinic.appointment.security.JwtAuthenticationFilter;
import com.clinic.appointment.security.JwtProperties;
import com.clinic.appointment.security.JwtService;
import com.clinic.appointment.security.SecurityConfig;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.appointment.service.ReceptionSchedulingService;
import com.clinic.appointment.dto.ReceptionHistoryResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Signed JWT -> actual JwtAuthenticationFilter -> actual security chain -> @PreAuthorize. */
@WebMvcTest({ReceptionQueueController.class, ReceptionSchedulingController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, ReceptionJwtFilterSecurityTest.JwtTestConfig.class})
class ReceptionJwtFilterSecurityTest {
    @TestConfiguration
    static class JwtTestConfig {
        @Bean
        JwtService jwtService() {
            return new JwtService(new JwtProperties(
                    "reception-test-secret-0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF", 60, 7));
        }
    }

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @MockBean IdentityAccountClient identityAccountClient;
    @MockBean ReceptionQueueService queue;
    @MockBean ReceptionSchedulingService scheduling;

    @BeforeEach
    void identityConfirmsCurrentRolesForSignedAccessTokens() {
        when(identityAccountClient.isCurrentAccount(anyString(), any(UUID.class), anySet()))
                .thenReturn(true);
    }

    private String token(String role) {
        return "Bearer " + jwtService.generateAccessToken(UUID.randomUUID(), "test@example.invalid", List.of(role));
    }

    @Test
    void receptionistJwtCanReadBookingsThroughActualFilter() throws Exception {
        when(scheduling.list(null, null)).thenReturn(List.of());
        mvc.perform(get("/api/appointments/reception/bookings")
                        .header("Authorization", token("ROLE_RECEPTIONIST")))
                .andExpect(status().isOk());
        verify(scheduling).list(null, null);
    }

    @Test
    void patientJwtCannotReadStaffBookingsOrQueue() throws Exception {
        String patient = token("ROLE_PATIENT");
        mvc.perform(get("/api/appointments/reception/bookings").header("Authorization", patient))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/appointments/reception/queue").header("Authorization", patient))
                .andExpect(status().isForbidden());
        verifyNoInteractions(scheduling, queue);
    }

    @Test
    void doctorJwtCanReadOwnQueueButCannotCheckIn() throws Exception {
        when(queue.list(isNull(), isNull(), any(CurrentUserPrincipal.class), anyString())).thenReturn(List.of());
        String doctor = token("ROLE_DOCTOR");
        mvc.perform(get("/api/appointments/reception/queue").header("Authorization", doctor))
                .andExpect(status().isOk());
        verify(queue).list(isNull(), isNull(), argThat(p -> p.hasRole("DOCTOR")
                && p.roles().contains("ROLE_DOCTOR")), eq(doctor));
        mvc.perform(post("/api/appointments/reception/00000000-0000-0000-0000-000000000001/check-in")
                        .header("Authorization", doctor))
                .andExpect(status().isForbidden());
        verify(queue, never()).checkIn(any());
    }

    @Test
    void patientJwtCannotReadThirtyDayStaffHistory() throws Exception {
        mvc.perform(get("/api/appointments/reception/dashboard/history")
                        .param("from", "2026-08-22").param("to", "2026-09-20")
                        .header("Authorization", token("ROLE_PATIENT")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(queue);
    }

    @Test
    void doctorJwtHistoryPassesIdentityToScopedService() throws Exception {
        String doctor = token("ROLE_DOCTOR");
        LocalDate from = LocalDate.of(2026, 8, 22);
        LocalDate to = LocalDate.of(2026, 9, 20);
        when(queue.history(eq(from), eq(to), any(CurrentUserPrincipal.class), eq(doctor)))
                .thenReturn(new ReceptionHistoryResponse(from, to, "DOCTOR", List.of()));
        mvc.perform(get("/api/appointments/reception/dashboard/history")
                        .param("from", "2026-08-22").param("to", "2026-09-20")
                        .header("Authorization", doctor))
                .andExpect(status().isOk());
        verify(queue).history(eq(from), eq(to), argThat(p -> p.hasRole("DOCTOR") && !p.hasRole("ADMIN")), eq(doctor));
    }
}