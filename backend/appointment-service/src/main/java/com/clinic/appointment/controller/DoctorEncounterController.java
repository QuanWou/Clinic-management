package com.clinic.appointment.controller;

import com.clinic.appointment.dto.EncounterContextResponse;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class DoctorEncounterController {

    private final ReceptionQueueService receptionQueueService;

    @GetMapping("/{appointmentId}/encounter")
    @PreAuthorize("hasAnyRole('DOCTOR', 'ADMIN')")
    public ApiResponse<EncounterContextResponse> encounter(
            @PathVariable UUID appointmentId,
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ApiResponse.success("Encounter context retrieved",
                receptionQueueService.getEncounterContext(appointmentId, principal, authorization));
    }
}
