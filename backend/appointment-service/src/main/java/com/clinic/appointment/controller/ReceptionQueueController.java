package com.clinic.appointment.controller;

import com.clinic.appointment.dto.ReceptionVisitResponse;
import com.clinic.appointment.dto.ReceptionHistoryResponse;
import com.clinic.appointment.dto.UpdateQueueStatusRequest;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments/reception")
@PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST', 'DOCTOR')")
@RequiredArgsConstructor
public class ReceptionQueueController {
    private final ReceptionQueueService service;

    @PostMapping("/{appointmentId}/check-in")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
    public ApiResponse<ReceptionVisitResponse> checkIn(@PathVariable UUID appointmentId) {
        return ApiResponse.success("Patient checked in", service.checkIn(appointmentId));
    }

    @GetMapping("/queue")
    public ApiResponse<List<ReceptionVisitResponse>> queue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID doctorId,
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.success("Queue retrieved", service.list(date, doctorId, principal, authorization));
    }

    @GetMapping("/dashboard/history")
    public ApiResponse<ReceptionHistoryResponse> history(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.success("Role-scoped dashboard history", service.history(from, to, principal, authorization));
    }

    @PatchMapping("/queue/{visitId}")
    public ApiResponse<ReceptionVisitResponse> changeStatus(
            @PathVariable UUID visitId,
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @Valid @RequestBody UpdateQueueStatusRequest request) {
        return ApiResponse.success("Queue status updated", service.changeStatus(visitId, request.status(), principal, authorization));
    }
}