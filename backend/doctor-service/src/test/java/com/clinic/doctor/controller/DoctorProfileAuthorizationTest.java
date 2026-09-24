package com.clinic.doctor.controller;

import com.clinic.doctor.dto.DoctorProfileResponse;
import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.security.JwtAuthenticationFilter;
import com.clinic.doctor.service.DoctorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContext;
import org.springframework.security.test.context.support.WithSecurityContextFactory;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DoctorController.class)
@AutoConfigureMockMvc(addFilters = false)
class DoctorProfileAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean DoctorService service;
    @MockBean JwtAuthenticationFilter filter;

    @Test
    @AsDoctor
    void doctorCannotSubmitSpecialtyChange() throws Exception {
        mvc.perform(put("/api/doctors/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"biography\":\"Hello\",\"specialtyId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    @AsDoctor
    void doctorCannotSubmitConsultationFeeChange() throws Exception {
        mvc.perform(put("/api/doctors/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"biography\":\"Hello\",\"consultationFee\":0}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    @AsDoctor
    void doctorCanUpdateBiographyOnly() throws Exception {
        when(service.updateProfile(any(UUID.class), any())).thenReturn(
                new DoctorProfileResponse(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                        "Cardiology", "Hello", new BigDecimal("350000.00")));
        mvc.perform(put("/api/doctors/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"biography\":\"Hello\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.biography").value("Hello"))
                .andExpect(jsonPath("$.data.consultationFee").value(350000.00));
        verify(service).updateProfile(any(UUID.class), argThat(req -> "Hello".equals(req.biography())));
    }

    @Retention(RetentionPolicy.RUNTIME)
    @WithSecurityContext(factory = DoctorContextFactory.class)
    @interface AsDoctor { }

    public static class DoctorContextFactory implements WithSecurityContextFactory<AsDoctor> {
        @Override
        public SecurityContext createSecurityContext(AsDoctor annotation) {
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            var principal = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@example.test", "Doctor", Set.of("ROLE_DOCTOR"));
            context.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_DOCTOR"))));
            return context;
        }
    }
}