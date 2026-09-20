package com.clinic.identity.controller;

import com.clinic.identity.security.CustomUserDetailsService;
import com.clinic.identity.security.JwtAuthenticationFilter;
import com.clinic.identity.security.SecurityConfig;
import com.clinic.identity.service.AdminUserService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminUserController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class AdminUserAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean AdminUserService service;
    @MockBean JwtAuthenticationFilter filter;
    @MockBean CustomUserDetailsService details;

    @Test
    @WithMockUser(roles = "PATIENT")
    void patientCannotListUsers() throws Exception {
        mvc.perform(get("/api/users/admin")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanListUsers() throws Exception {
        when(service.list(any(Pageable.class))).thenReturn(Page.empty());
        mvc.perform(get("/api/users/admin")).andExpect(status().isOk());
        verify(service).list(any(Pageable.class));
    }
}