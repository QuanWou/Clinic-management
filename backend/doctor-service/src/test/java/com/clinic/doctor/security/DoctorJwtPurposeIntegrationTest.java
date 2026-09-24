package com.clinic.doctor.security;

import com.clinic.doctor.controller.AdminDoctorController;
import com.clinic.doctor.service.AdminDoctorService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminDoctorController.class)
@AutoConfigureMockMvc(addFilters = true)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
@TestPropertySource(properties = {
        "app.security.jwt.secret=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
        "app.security.jwt.access-token-expiration-minutes=60",
        "app.security.jwt.refresh-token-expiration-days=7"
})
class DoctorJwtPurposeIntegrationTest {
    private static final String SECRET = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @MockBean AdminDoctorService service;

    @Test
    void adminRefreshAndUntypedTokensCannotUseDoctorAdminApi() throws Exception {
        String refresh = signed("refresh");
        String legacy = signed(null);
        assertFalse(jwt.isAccessTokenValid(refresh));
        assertFalse(jwt.isAccessTokenValid(legacy));
        mvc.perform(get("/api/doctors/admin").header("Authorization", "Bearer " + refresh))
                .andExpect(status().is4xxClientError());
        mvc.perform(get("/api/doctors/admin").header("Authorization", "Bearer " + legacy))
                .andExpect(status().is4xxClientError());
        verifyNoInteractions(service);
    }

    @Test
    void realFilterAllowsSignedAccessWithAdminRole() throws Exception {
        String access = jwt.generateAccessToken(UUID.randomUUID(), "admin@example.test", List.of("ROLE_ADMIN"));
        assertTrue(jwt.isAccessTokenValid(access));
        when(service.doctors(any(Pageable.class))).thenReturn(Page.empty());
        mvc.perform(get("/api/doctors/admin").header("Authorization", "Bearer " + access))
                .andExpect(status().isOk());
        verify(service).doctors(any(Pageable.class));
    }

    private static String signed(String type) {
        var builder = Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("email", "admin@example.test")
                .claim("roles", List.of("ROLE_ADMIN"))
                .issuedAt(new Date(System.currentTimeMillis() - 1000))
                .expiration(new Date(System.currentTimeMillis() + 60000));
        if (type != null) builder.claim("token_type", type);
        return builder.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }
}