package com.clinic.doctor.controller;

import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.security.JwtAuthenticationFilter;
import com.clinic.doctor.security.SecurityConfig;
import com.clinic.doctor.service.DoctorService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DoctorController.class)
@Import(SecurityConfig.class)
class DoctorControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DoctorService doctorService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void passRequestsThroughJwtFilter() throws Exception {
        doAnswer(invocation -> {
            FilterChain filterChain = invocation.getArgument(2);
            filterChain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    void authenticatedPatientCanBrowseDoctors() throws Exception {
        when(doctorService.getDoctors(null)).thenReturn(List.of());

        mockMvc.perform(get("/api/doctors")
                        .with(authentication(tokenAuthentication(UUID.randomUUID(), "ROLE_PATIENT"))))
                .andExpect(status().isOk());

        verify(doctorService).getDoctors(null);
    }

    @Test
    void doctorCanReplaceOnlyTheirAuthenticatedSchedule() throws Exception {
        UUID userId = UUID.randomUUID();
        when(doctorService.replaceSchedules(eq(userId), any())).thenReturn(List.of());

        mockMvc.perform(put("/api/doctors/profile/schedules")
                        .with(authentication(tokenAuthentication(userId, "ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schedules":[{"dayOfWeek":1,"startTime":"08:00","endTime":"12:00"}]}
                                """))
                .andExpect(status().isOk());

        verify(doctorService).replaceSchedules(eq(userId), any());
    }

    @Test
    void patientCannotReplaceDoctorSchedule() throws Exception {
        mockMvc.perform(put("/api/doctors/profile/schedules")
                        .with(authentication(tokenAuthentication(UUID.randomUUID(), "ROLE_PATIENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schedules":[{"dayOfWeek":1,"startTime":"08:00","endTime":"12:00"}]}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(doctorService);
    }

    @Test
    void invalidSchedulePayloadReturnsBadRequest() throws Exception {
        mockMvc.perform(put("/api/doctors/profile/schedules")
                        .with(authentication(tokenAuthentication(UUID.randomUUID(), "ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"schedules":[{"dayOfWeek":9,"startTime":"08:00","endTime":"12:00"}]}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(doctorService);
    }

    @Test
    void malformedAvailabilityTimeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/doctors/{doctorId}/availability", UUID.randomUUID())
                        .with(authentication(tokenAuthentication(UUID.randomUUID(), "ROLE_PATIENT")))
                        .param("dayOfWeek", "1")
                        .param("startTime", "not-a-time")
                        .param("endTime", "12:00"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(doctorService);
    }

    private UsernamePasswordAuthenticationToken tokenAuthentication(UUID userId, String role) {
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                userId,
                "user@clinic.local",
                "Clinic User",
                Set.of(role)
        );
        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority(role))
        );
    }
}
