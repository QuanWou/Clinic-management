package com.clinic.doctor.controller;

import com.clinic.doctor.security.JwtAuthenticationFilter;
import com.clinic.doctor.security.SecurityConfig;
import com.clinic.doctor.service.AdminDoctorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.http.MediaType;
import java.util.UUID;

@WebMvcTest(AdminDoctorController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class AdminDoctorAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean AdminDoctorService service;
    @MockBean JwtAuthenticationFilter filter;

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotListDoctors() throws Exception {
        mvc.perform(get("/api/doctors/admin")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanListDoctors() throws Exception {
        when(service.doctors(any(Pageable.class))).thenReturn(Page.empty());
        mvc.perform(get("/api/doctors/admin")).andExpect(status().isOk());
        verify(service).doctors(any(Pageable.class));
    }

    @Test
    @WithMockUser(roles = "DOCTOR")
    void doctorCannotEditAdministrativeFeeOrSpecialty() throws Exception {
        mvc.perform(put("/api/doctors/admin/{id}", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"specialtyId\":\"" + UUID.randomUUID()
                        + "\",\"consultationFee\":0,\"active\":true}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
}