package com.clinic.patient.controller;

import com.clinic.patient.security.JwtAuthenticationFilter;
import com.clinic.patient.security.JwtProperties;
import com.clinic.patient.security.JwtService;
import com.clinic.patient.security.SecurityConfig;
import com.clinic.patient.service.ReceptionPatientService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Signed JWT passes the actual servlet security filter chain, not @WithMockUser. */
@WebMvcTest(ReceptionPatientController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, ReceptionPatientJwtFilterSecurityTest.JwtTestConfig.class})
class ReceptionPatientJwtFilterSecurityTest {
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
    @MockBean ReceptionPatientService service;

    private String token(String role) {
        return "Bearer " + jwtService.generateAccessToken(UUID.randomUUID(), "test@example.invalid", List.of(role));
    }

    @Test
    void receptionistJwtCanSearch() throws Exception {
        when(service.search(null, "Alice")).thenReturn(List.of());
        mvc.perform(get("/api/patients/reception").param("name", "Alice")
                        .header("Authorization", token("ROLE_RECEPTIONIST")))
                .andExpect(status().isOk());
        verify(service).search(null, "Alice");
    }

    @Test
    void patientJwtCannotSearch() throws Exception {
        mvc.perform(get("/api/patients/reception").param("name", "Alice")
                        .header("Authorization", token("ROLE_PATIENT")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void staffJwtCanListPatientsButPatientJwtCannot() throws Exception {
        when(service.list(0, 20)).thenReturn(Page.empty());
        mvc.perform(get("/api/patients/reception/list")
                        .header("Authorization", token("ROLE_ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content").isArray());
        mvc.perform(get("/api/patients/reception/list")
                        .header("Authorization", token("ROLE_RECEPTIONIST")))
                .andExpect(status().isOk());
        verify(service, times(2)).list(0, 20);
        mvc.perform(get("/api/patients/reception/list")
                        .header("Authorization", token("ROLE_PATIENT")))
                .andExpect(status().isForbidden());
        verifyNoMoreInteractions(service);
    }

    @Test
    void onlyStaffCanResolvePublicPatientCodeThroughRealJwtFilter() throws Exception {
        when(service.getByCode("BN000513")).thenReturn(new com.clinic.patient.dto.ReceptionPatientResponse(
                UUID.randomUUID(), null, "Đặng Gia Phong", null, null, null, null, null, "BN000513"));
        mvc.perform(get("/api/patients/reception/code/BN000513")
                .header("Authorization", token("ROLE_ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.patientCode").value("BN000513"));
        mvc.perform(get("/api/patients/reception/code/BN000513")
                .header("Authorization", token("ROLE_RECEPTIONIST")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/patients/reception/code/BN000513")
                .header("Authorization", token("ROLE_PATIENT")))
                .andExpect(status().isForbidden());
        verify(service, times(2)).getByCode("BN000513");
        verifyNoMoreInteractions(service);
    }
}