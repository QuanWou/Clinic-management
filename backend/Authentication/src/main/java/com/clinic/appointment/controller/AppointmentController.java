package com.clinic.appointment.controller;

import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.service.AppointmentService;
import com.clinic.common.dto.ApiResponse;
import com.clinic.appointment.security.CurrentUserPrincipal;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;

    @PostMapping
    public ApiResponse<AppointmentResponse> create(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @Valid @RequestBody CreateAppointmentRequest request
    ) {
        return ApiResponse.success(
                "Appointment created successfully",
                appointmentService.create(principal.id(), authorizationHeader, request)
        );
    }

    @GetMapping("/my")
    public ApiResponse<List<AppointmentResponse>> getMyAppointments(
           @AuthenticationPrincipal CurrentUserPrincipal principal,
           @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader
    ) {
        return ApiResponse.success(
                "Fetched appointments successfully",
                appointmentService.getMyAppointments(principal.id(), authorizationHeader)
        );
    }

    @GetMapping("/{id}")
    public ApiResponse<AppointmentResponse> getById(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Appointment fetched successfully",
                appointmentService.getById(principal.id(), authorizationHeader, principal, id)
        );
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<AppointmentResponse> cancel(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Appointment cancelled successfully",
                appointmentService.cancel(principal.id(), authorizationHeader, id)
        );
    }

    @PatchMapping("/{id}/confirm")
    public ApiResponse<AppointmentResponse> confirm(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Appointment confirmed successfully",
                appointmentService.confirm(principal.id(), principal, id)
        );
    }

    @PatchMapping("/{id}/complete")
    public ApiResponse<AppointmentResponse> complete(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Appointment completed successfully",
                appointmentService.complete(principal.id(), principal, id)
        );
    }
}
