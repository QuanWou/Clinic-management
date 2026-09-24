package com.clinic.billing.controller;

import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.CashPaymentRequest;
import com.clinic.billing.dto.CashRefundRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.PaymentTransactionResponse;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.billing.service.BillingService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.data.domain.Page;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    /** Bounded, server-paginated directory for staff; patients must use /my. */
    @GetMapping("/staff")
    public ApiResponse<Page<InvoiceResponse>> getStaffInvoices(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success("Staff invoices fetched successfully", billingService.getStaffInvoices(principal, page, size));
    }

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

    @PostMapping("/{id}/cash-payment")
    public ApiResponse<InvoiceResponse> confirmCashPayment(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id,
            @Valid @RequestBody CashPaymentRequest request
    ) {
        return ApiResponse.success(
                "Cash receipt confirmed by cashier",
                billingService.confirmCashPayment(principal, id, request)
        );
    }

    @PostMapping("/{id}/cash-refund")
    public ApiResponse<InvoiceResponse> confirmCashRefund(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id,
            @Valid @RequestBody CashRefundRequest request
    ) {
        return ApiResponse.success("Cash refund confirmed", billingService.confirmCashRefund(principal, id, request));
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<InvoiceResponse> cancel(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success("Unpaid invoice cancelled", billingService.cancel(principal, id));
    }

    @GetMapping("/{id}/transactions")
    public ApiResponse<List<PaymentTransactionResponse>> getTransactions(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable("id") UUID id
    ) {
        return ApiResponse.success("Payment transactions fetched", billingService.getTransactions(principal, id));
    }
}
