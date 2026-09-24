package com.clinic.notification.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.dto.NotificationPreferenceResponse;
import com.clinic.notification.dto.UpdateNotificationPreferenceRequest;
import com.clinic.notification.entity.NotificationType;
import com.clinic.notification.service.NotificationPreferenceService;
import com.clinic.notification.service.NotificationService;
import com.clinic.notification.security.CurrentUserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationPreferenceService preferenceService;

    @GetMapping("/my/preferences")
    public ApiResponse<List<NotificationPreferenceResponse>> preferences(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Success", preferenceService.mine(principal.id()));
    }

    @PutMapping("/my/preferences/{type}")
    public ApiResponse<NotificationPreferenceResponse> updatePreference(@PathVariable NotificationType type,
            @Valid @RequestBody UpdateNotificationPreferenceRequest request,
            @AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Success", preferenceService.update(principal.id(), type, request.enabled()));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_RECEPTIONIST')")
    public ApiResponse<NotificationResponse> send(@Valid @RequestBody NotificationRequest request) {
        return ApiResponse.success("Notification recorded successfully", notificationService.send(request));
    }

    @GetMapping("/my")
    public ApiResponse<List<NotificationResponse>> mine(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Success", notificationService.getMine(principal.id()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<NotificationResponse> markRead(@PathVariable UUID id,
            @AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Success", notificationService.markRead(id, principal.id()));
    }

    @GetMapping("/{id}")
    public ApiResponse<NotificationResponse> getById(@PathVariable UUID id,
            @AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ApiResponse.success("Success", notificationService.getById(id, principal));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_RECEPTIONIST')")
    public ApiResponse<List<NotificationResponse>> getAll() {
        return ApiResponse.success("Success", notificationService.getAll());
    }
}
