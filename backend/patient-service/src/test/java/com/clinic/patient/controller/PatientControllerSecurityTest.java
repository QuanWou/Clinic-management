package com.clinic.patient.controller;

import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.security.CurrentUserPrincipal;
import com.clinic.patient.security.JwtAuthenticationFilter;
import com.clinic.patient.security.SecurityConfig;
import com.clinic.patient.service.PatientService;
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

import java.time.LocalDate;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PatientController.class)
@Import(SecurityConfig.class)
class PatientControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PatientService patientService;

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
    void patientCanUpdateOnlyTheirAuthenticatedProfile() throws Exception {
        UUID userId = UUID.randomUUID();
        when(patientService.updateProfile(eq(userId), any())).thenReturn(new PatientProfileResponse(
                UUID.randomUUID(), userId, LocalDate.of(1990, 1, 1), "FEMALE", null, null, null
        ));

        mockMvc.perform(put("/api/patients/profile")
                        .with(authentication(tokenAuthentication(userId, "ROLE_PATIENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dob":"1990-01-01","gender":"FEMALE","address":"","bloodType":null}
                                """))
                .andExpect(status().isOk());

        verify(patientService).updateProfile(eq(userId), any());
    }

    @Test
    void doctorCannotUpdatePatientProfile() throws Exception {
        mockMvc.perform(put("/api/patients/profile")
                        .with(authentication(tokenAuthentication(UUID.randomUUID(), "ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dob":"1990-01-01","gender":"MALE"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(patientService);
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
