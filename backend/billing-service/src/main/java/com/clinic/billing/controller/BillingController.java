package com.clinic.billing.controller;

import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.PayInvoiceRequest;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.billing.service.BillingService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    @PostMapping
    public ApiResponse<InvoiceResponse> create(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @Valid @RequestBody CreateInvoiceRequest request
    ) {
        return ApiResponse.success(
                "Invoice created successfully",
                billingService.create(principal.id(), authorizationHeader, principal, request)
        );
    }

    @GetMapping("/my")
    public ApiResponse<List<InvoiceResponse>> getMyInvoices(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader
    ) {
        return ApiResponse.success(
                "Invoices fetched successfully",
                billingService.getMyInvoices(principal.id(), authorizationHeader, principal)
        );
    }

    @GetMapping("/patients/{patientId}")
    public ApiResponse<List<InvoiceResponse>> getByPatientId(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("patientId") UUID patientId
    ) {
        return ApiResponse.success(
                "Patient invoices fetched successfully",
                billingService.getByPatientId(principal.id(), principal, patientId)
        );
    }

    @GetMapping("/appointments/{appointmentId}")
    public ApiResponse<InvoiceResponse> getByAppointmentId(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("appointmentId") UUID appointmentId
    ) {
        return ApiResponse.success(
                "Invoice fetched successfully",
                billingService.getByAppointmentId(principal.id(), authorizationHeader, principal, appointmentId)
        );
    }

    @GetMapping("/{id}")
    public ApiResponse<InvoiceResponse> getById(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success(
                "Invoice fetched successfully",
                billingService.getById(principal.id(), authorizationHeader, principal, id)
        );
    }

    @PatchMapping("/{id}/pay")
    public ApiResponse<InvoiceResponse> pay(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable("id") UUID id,
            @Valid @RequestBody PayInvoiceRequest request
    ) {
        return ApiResponse.success(
                "Invoice paid successfully",
                billingService.pay(principal.id(), authorizationHeader, principal, id, request)
        );
    }
}
