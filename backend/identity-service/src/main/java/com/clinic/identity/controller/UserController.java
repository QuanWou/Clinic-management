package com.clinic.identity.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.identity.dto.UserMeResponse;
import com.clinic.identity.security.CurrentUserPrincipal;
import com.clinic.identity.service.AuthService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public ApiResponse<UserMeResponse> me(@AuthenticationPrincipal CurrentUserPrincipal currentUser) {
        return ApiResponse.success("Current user fetched successfully", authService.me(currentUser));
    }
}