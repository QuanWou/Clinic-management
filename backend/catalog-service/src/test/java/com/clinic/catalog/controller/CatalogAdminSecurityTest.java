package com.clinic.catalog.controller;

import com.clinic.catalog.dto.CatalogServiceResponse;
import com.clinic.catalog.service.CatalogService;
import com.clinic.catalog.security.SecurityConfig;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CatalogAdminController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.security.jwt.secret=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF")
class CatalogAdminSecurityTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
    private static final String PAYLOAD = "{\"code\":\"EXAM\",\"name\":\"Examination\",\"active\":true}";

    @Autowired MockMvc mvc;
    @MockBean CatalogService service;

    @Test
    void patientCannotCreateService() throws Exception {
        mvc.perform(post("/api/catalog/admin/services")
                .header("Authorization", token("ROLE_PATIENT"))
                .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void anonymousCannotCreateService() throws Exception {
        mvc.perform(post("/api/catalog/admin/services").contentType(MediaType.APPLICATION_JSON)
                .content(PAYLOAD)).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void adminCanCreateService() throws Exception {
        when(service.createService(any(UUID.class), any())).thenReturn(
                new CatalogServiceResponse(UUID.randomUUID(), "EXAM", "Examination", null, true));
        mvc.perform(post("/api/catalog/admin/services")
                .header("Authorization", token("ROLE_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("EXAM"));
        verify(service).createService(any(UUID.class), any());
    }

    @Test
    void adminRequestIsValidated() throws Exception {
        mvc.perform(post("/api/catalog/admin/services")
                .header("Authorization", token("ROLE_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"invalid code\",\"name\":\"\",\"active\":true}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void patientCannotReadInactiveAdminCatalog() throws Exception {
        mvc.perform(get("/api/catalog/admin/services")
                .header("Authorization", token("ROLE_PATIENT")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void adminCanListInactiveCatalogRecords() throws Exception {
        when(service.allServices()).thenReturn(List.of(
                new CatalogServiceResponse(UUID.randomUUID(), "OLD", "Legacy", null, false)));
        mvc.perform(get("/api/catalog/admin/services")
                .header("Authorization", token("ROLE_ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].active").value(false));
        verify(service).allServices();
    }

    @Test
    void signedRefreshTokenCannotReadOrModifyAdminCatalogEvenWithAdminRoleClaim() throws Exception {
        mvc.perform(get("/api/catalog/admin/services")
                        .header("Authorization", token("ROLE_ADMIN", "refresh")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/catalog/admin/services")
                        .header("Authorization", token("ROLE_ADMIN", "refresh"))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYLOAD))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void legacyUntypedTokenCannotReadAdminCatalog() throws Exception {
        mvc.perform(get("/api/catalog/admin/services")
                        .header("Authorization", token("ROLE_ADMIN", null)))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    private String token(String role) {
        return token(role, "access");
    }

    private String token(String role, String purpose) {
        var builder = Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("email", "admin@example.test")
                .claim("roles", List.of(role))
                .issuedAt(new Date(System.currentTimeMillis() - 1000))
                .expiration(new Date(System.currentTimeMillis() + 60000));
        if (purpose != null) builder.claim("token_type", purpose);
        String jwt = builder
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
        return "Bearer " + jwt;
    }
}