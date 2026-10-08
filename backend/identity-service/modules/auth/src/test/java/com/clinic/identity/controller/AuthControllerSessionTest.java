package com.clinic.identity.controller;

import com.clinic.identity.dto.AuthResponse;
import com.clinic.identity.dto.LoginRequest;
import com.clinic.identity.security.JwtProperties;
import com.clinic.identity.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

class AuthControllerSessionTest {

    @Test
    void legacyLoginWithoutChannelKeepsBodyRefreshCompatibility() {
        AuthService auth = mock(AuthService.class);
        when(auth.login(any())).thenReturn(auth("access-legacy", "refresh-legacy"));
        AuthController controller = new AuthController(auth, new JwtProperties("unused", 60, 7));
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthResponse body = controller.login(new LoginRequest("legacy@example.test", "secret"),
                null, new MockHttpServletRequest(), response).data();

        assertEquals("refresh-legacy", body.refreshToken());
        assertNull(response.getHeader("Set-Cookie"));
    }

    @Test
    void workspaceLoginStoresRefreshTokenOnlyInHttpOnlyChannelCookie() {
        AuthService auth = mock(AuthService.class);
        AuthResponse response = auth("access-1", "refresh-1");
        when(auth.login(any())).thenReturn(response);
        AuthController controller = new AuthController(auth, new JwtProperties("unused", 60, 7));
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();

        AuthResponse body = controller.login(new LoginRequest("doctor@example.test", "secret"),
                "workspace", new MockHttpServletRequest(), servletResponse).data();

        String cookie = servletResponse.getHeader("Set-Cookie");
        assertNotNull(cookie);
        assertNull(body.refreshToken());
        assertTrue(cookie.startsWith("clinic_refresh_workspace=refresh-1"));
        assertTrue(cookie.contains("Path=/s1/auth/api/auth"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Strict"));
    }

    @Test
    void cookieRefreshRotatesPersistedTokenAndReturnsFreshAccessToken() {
        AuthService auth = mock(AuthService.class);
        when(auth.refresh(argThat(request -> "old-refresh".equals(request.refreshToken()))))
                .thenReturn(auth("access-2", "new-refresh"));
        AuthController controller = new AuthController(auth, new JwtProperties("unused", 60, 7));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("clinic_refresh_workspace", "old-refresh"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        AuthResponse refreshed = controller.refreshSession("workspace", request, response).data();

        assertEquals("access-2", refreshed.accessToken());
        assertNull(refreshed.refreshToken());
        assertTrue(response.getHeader("Set-Cookie").startsWith("clinic_refresh_workspace=new-refresh"));
        verify(auth).refresh(argThat(value -> "old-refresh".equals(value.refreshToken())));
    }

    @Test
    void cookieLogoutRevokesServerTokenAndExpiresOnlyRequestedChannel() {
        AuthService auth = mock(AuthService.class);
        AuthController controller = new AuthController(auth, new JwtProperties("unused", 60, 7));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("clinic_refresh_patient", "patient-refresh"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        controller.logoutSession("patient", request, response);

        verify(auth).logout(argThat(value -> "patient-refresh".equals(value.refreshToken())));
        String cookie = response.getHeader("Set-Cookie");
        assertNotNull(cookie);
        assertTrue(cookie.startsWith("clinic_refresh_patient="));
        assertTrue(cookie.contains("Max-Age=0"));
    }

    private AuthResponse auth(String access, String refresh) {
        return new AuthResponse(UUID.randomUUID(), "doctor@example.test", "Bác sĩ Kiểm thử",
                Set.of("ROLE_DOCTOR"), access, refresh);
    }
}