package com.clinic.patient.controller;

import com.clinic.patient.security.JwtAuthenticationFilter;
import com.clinic.patient.security.JwtService;
import com.clinic.patient.service.ReceptionPatientService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReceptionPatientController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(ReceptionPatientControllerSecurityTest.MethodSecurity.class)
class ReceptionPatientControllerSecurityTest {
    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @MockBean ReceptionPatientService service;
    @MockBean JwtService jwtService;
    @MockBean JwtAuthenticationFilter jwtFilter;

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotSearchOtherPatients() throws Exception {
        mvc.perform(get("/api/patients/reception").param("name", "Alice"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(roles = "RECEPTIONIST")
    void receptionistCanSearchPatients() throws Exception {
        when(service.search(null, "Alice")).thenReturn(List.of());
        mvc.perform(get("/api/patients/reception").param("name", "Alice"))
                .andExpect(status().isOk());
        verify(service).search(null, "Alice");
    }
}