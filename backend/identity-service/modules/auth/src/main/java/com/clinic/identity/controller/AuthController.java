package com.clinic.identity.controller;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.dto.ApiResponse;
import com.clinic.common.exception.BusinessException;
import com.clinic.identity.dto.AuthResponse;
import com.clinic.identity.dto.LoginRequest;
import com.clinic.identity.dto.RefreshTokenRequest;
import com.clinic.identity.dto.RegisterRequest;
import com.clinic.identity.security.JwtProperties;
import com.clinic.identity.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String CHANNEL_HEADER = "X-Auth-Channel";
    private static final String COOKIE_PREFIX = "clinic_refresh_";
    private static final String COOKIE_PATH = "/s1/auth/api/auth";
    private final AuthService authService;
    private final JwtProperties jwtProperties;

    public AuthController(AuthService authService, JwtProperties jwtProperties) {
        this.authService = authService;
        this.jwtProperties = jwtProperties;
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                               @RequestHeader(value = CHANNEL_HEADER, required = false) String channel,
                                               HttpServletRequest servletRequest,
                                               HttpServletResponse servletResponse) {
        AuthResponse auth = authService.register(request);
        if (channel == null || channel.isBlank()) {
            return ApiResponse.success("Register successfully", auth);
        }
        writeSessionCookie(channel, auth.refreshToken(), servletRequest, servletResponse);
        return ApiResponse.success("Register successfully", withoutRefreshToken(auth));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                            @RequestHeader(value = CHANNEL_HEADER, required = false) String channel,
                                            HttpServletRequest servletRequest,
                                            HttpServletResponse servletResponse) {
        AuthResponse auth = authService.login(request);
        if (channel == null || channel.isBlank()) {
            return ApiResponse.success("Login successfully", auth);
        }
        writeSessionCookie(channel, auth.refreshToken(), servletRequest, servletResponse);
        return ApiResponse.success("Login successfully", withoutRefreshToken(auth));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.success("Token refreshed successfully", authService.refresh(request));
    }

    @PostMapping("/session/refresh")
    public ApiResponse<AuthResponse> refreshSession(@RequestHeader(value = CHANNEL_HEADER, defaultValue = "patient") String channel,
                                                     HttpServletRequest servletRequest,
                                                     HttpServletResponse servletResponse) {
        String refreshToken = readSessionCookie(channel, servletRequest);
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Session refresh token not found");
        }
        AuthResponse auth = authService.refresh(new RefreshTokenRequest(refreshToken));
        writeSessionCookie(channel, auth.refreshToken(), servletRequest, servletResponse);
        return ApiResponse.success("Session refreshed successfully", withoutRefreshToken(auth));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return ApiResponse.success("Logout successfully", null);
    }

    @PostMapping("/session/logout")
    public ApiResponse<Void> logoutSession(@RequestHeader(value = CHANNEL_HEADER, defaultValue = "patient") String channel,
                                            HttpServletRequest servletRequest,
                                            HttpServletResponse servletResponse) {
        String refreshToken = readSessionCookie(channel, servletRequest);
        try {
            if (refreshToken != null && !refreshToken.isBlank()) {
                authService.logout(new RefreshTokenRequest(refreshToken));
            }
        } finally {
            clearSessionCookie(channel, servletRequest, servletResponse);
        }
        return ApiResponse.success("Logout successfully", null);
    }

    private String readSessionCookie(String channel, HttpServletRequest request) {
        String name = cookieName(channel);
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private void writeSessionCookie(String channel, String refreshToken, HttpServletRequest request, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(cookieName(channel), refreshToken)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(Duration.ofDays(jwtProperties.refreshTokenExpirationDays()))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearSessionCookie(String channel, HttpServletRequest request, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(cookieName(channel), "")
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String cookieName(String channel) {
        return COOKIE_PREFIX + ("workspace".equalsIgnoreCase(channel) ? "workspace" : "patient");
    }

    private AuthResponse withoutRefreshToken(AuthResponse auth) {
        return new AuthResponse(auth.userId(), auth.email(), auth.fullName(), auth.roles(),
                auth.accessToken(), null, auth.accountCode());
    }
}