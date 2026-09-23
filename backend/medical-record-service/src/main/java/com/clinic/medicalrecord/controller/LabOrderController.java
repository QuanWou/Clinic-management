package com.clinic.medicalrecord.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.medicalrecord.dto.CollectLabSampleRequest;
import com.clinic.medicalrecord.dto.CreateLabOrderRequest;
import com.clinic.medicalrecord.dto.LabOrderResponse;
import com.clinic.medicalrecord.dto.LabBillableItemsResponse;
import com.clinic.medicalrecord.dto.RecordLabResultRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.LabOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/medical-records")
@RequiredArgsConstructor
public class LabOrderController {
    private final LabOrderService labOrders;

    @GetMapping("/appointments/{appointmentId}/billable-items")
    public ApiResponse<LabBillableItemsResponse> billableItems(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                               @PathVariable UUID appointmentId) {
        return ApiResponse.success("Lab billing items fetched", labOrders.billableItems(principal, appointmentId));
    }

    @PostMapping("/appointments/{appointmentId}/billable-items/finalize")
    public ApiResponse<LabBillableItemsResponse> finalizeBilling(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID appointmentId) {
        return ApiResponse.success("Lab billing items finalized",
                labOrders.finalizeBilling(principal, authorization, appointmentId));
    }

    @PostMapping("/{recordId}/lab-orders")
    public ApiResponse<LabOrderResponse> create(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                @PathVariable UUID recordId,
                                                @Valid @RequestBody CreateLabOrderRequest request) {
        return ApiResponse.success("Lab order created",
                labOrders.create(principal, authorization, recordId, idempotencyKey, request));
    }

    /** Only the treating doctor may read the lock state; billing amounts and item details stay staff-only. */
    @GetMapping("/{recordId}/lab-orders/billing-status")
    public ApiResponse<LabBillingStatus> billingStatus(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                       @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                       @PathVariable UUID recordId) {
        return ApiResponse.success("Lab billing status fetched", new LabBillingStatus(
                recordId, labOrders.isBillingFinalized(principal, authorization, recordId)));
    }

    public record LabBillingStatus(UUID medicalRecordId, boolean finalizedForBilling) {}

    @GetMapping("/{recordId}/lab-orders")
    public ApiResponse<List<LabOrderResponse>> list(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                    @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                    @PathVariable UUID recordId) {
        return ApiResponse.success("Lab orders fetched", labOrders.list(principal, authorization, recordId));
    }

    @GetMapping("/lab-orders/{orderId}")
    public ApiResponse<LabOrderResponse> get(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                             @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                             @PathVariable UUID orderId) {
        return ApiResponse.success("Lab order fetched", labOrders.get(principal, authorization, orderId));
    }

    @PatchMapping("/lab-orders/{orderId}/sample")
    public ApiResponse<LabOrderResponse> collect(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                 @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                 @PathVariable UUID orderId,
                                                 @Valid @RequestBody CollectLabSampleRequest request) {
        return ApiResponse.success("Sample collected", labOrders.collect(principal, authorization, orderId, request));
    }

    @PatchMapping("/lab-orders/{orderId}/processing")
    public ApiResponse<LabOrderResponse> process(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                 @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                 @PathVariable UUID orderId) {
        return ApiResponse.success("Sample processing", labOrders.startProcessing(principal, authorization, orderId));
    }

    @PatchMapping("/lab-orders/{orderId}/result")
    public ApiResponse<LabOrderResponse> result(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                @PathVariable UUID orderId,
                                                @Valid @RequestBody RecordLabResultRequest request) {
        return ApiResponse.success("Result recorded", labOrders.recordResult(principal, authorization, orderId, request));
    }

    @PatchMapping("/lab-orders/{orderId}/release")
    public ApiResponse<LabOrderResponse> release(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                 @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                 @PathVariable UUID orderId) {
        return ApiResponse.success("Result released", labOrders.release(principal, authorization, orderId));
    }
}
