package com.clinic.doctor.controller;

import com.clinic.doctor.dto.DoctorProfileResponse;
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

import java.math.BigDecimal;
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

/** Administrative doctor fields cannot be changed through the self-service profile API. */
@WebMvcTest(DoctorController.class)
@Import(SecurityConfig.class)
class DoctorConsultationFeeSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean DoctorService doctors;
    @MockBean JwtAuthenticationFilter filter;

    @BeforeEach
    void passThroughSecurityTestAuthentication() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(filter).doFilter(any(), any(), any());
    }

    private UsernamePasswordAuthenticationToken auth(UUID id, String role) {
        return new UsernamePasswordAuthenticationToken(
                new CurrentUserPrincipal(id, "doctor@example.test", "Test", Set.of(role)), null,
                List.of(new SimpleGrantedAuthority(role)));
    }

    private String feeRequest(UUID specialty, String fee) {
        return """
                {"specialtyId":"%s","biography":"Updated", "consultationFee":%s}
                """.formatted(specialty, fee);
    }

    @Test
    void doctorCannotUpdateAdministrativeProfileFields() throws Exception {
        UUID user = UUID.randomUUID();
        UUID specialty = UUID.randomUUID();

        mvc.perform(put("/api/doctors/profile")
                        .with(authentication(auth(user, "ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(feeRequest(specialty, "500000.00")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(doctors);
    }

    @Test
    void patientCannotUpdateConsultationFee() throws Exception {
        mvc.perform(put("/api/doctors/profile")
                        .with(authentication(auth(UUID.randomUUID(), "ROLE_PATIENT")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(feeRequest(UUID.randomUUID(), "500000.00")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(doctors);
    }

    @Test
    void negativeConsultationFeeIsRejectedBeforeServiceMutation() throws Exception {
        mvc.perform(put("/api/doctors/profile")
                        .with(authentication(auth(UUID.randomUUID(), "ROLE_DOCTOR")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(feeRequest(UUID.randomUUID(), "-0.01")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(doctors);
    }
}
