package com.clinic.appointment.controller;

import com.clinic.appointment.dto.AddPerformedServiceRequest;
import com.clinic.appointment.dto.PerformedServicesResponse;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.PerformedServicesService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/appointments/{appointmentId}/performed-services")
@RequiredArgsConstructor
public class PerformedServicesController {
    private final PerformedServicesService performedServices;

    @GetMapping
    public ApiResponse<PerformedServicesResponse> get(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                       @PathVariable UUID appointmentId) {
        return ApiResponse.success("Performed services fetched", performedServices.get(principal, appointmentId));
    }

    @PostMapping
    public ApiResponse<PerformedServicesResponse> add(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                       @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                       @PathVariable UUID appointmentId,
                                                       @Valid @RequestBody AddPerformedServiceRequest request) {
        return ApiResponse.success("Performed service recorded",
                performedServices.add(principal, authorization, appointmentId, request));
    }

    @DeleteMapping("/{itemId}")
    public ApiResponse<PerformedServicesResponse> remove(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                          @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                          @PathVariable UUID appointmentId,
                                                          @PathVariable UUID itemId) {
        return ApiResponse.success("Performed service removed",
                performedServices.remove(principal, authorization, appointmentId, itemId));
    }

    @PostMapping("/finalize")
    public ApiResponse<PerformedServicesResponse> finalizeForBilling(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID appointmentId) {
        return ApiResponse.success("Performed services finalized for billing",
                performedServices.finalizeForBilling(principal, authorization, appointmentId));
    }
}
