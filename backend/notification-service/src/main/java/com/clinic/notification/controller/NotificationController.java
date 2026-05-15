package com.clinic.notification.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.notification.dto.NotificationRequest;
import com.clinic.notification.dto.NotificationResponse;
import com.clinic.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping
    public ApiResponse<NotificationResponse> send(@Valid @RequestBody NotificationRequest request) {
        return ApiResponse.success("Notification sent successfully", notificationService.send(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<NotificationResponse> getById(@PathVariable UUID id) {
        return ApiResponse.success("Success", notificationService.getById(id));
    }

    @GetMapping
    public ApiResponse<List<NotificationResponse>> getAll() {
        return ApiResponse.success("Success", notificationService.getAll());
    }
}
