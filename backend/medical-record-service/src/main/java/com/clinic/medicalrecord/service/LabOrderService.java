package com.clinic.medicalrecord.service;

import com.clinic.medicalrecord.dto.CollectLabSampleRequest;
import com.clinic.medicalrecord.dto.CreateLabOrderRequest;
import com.clinic.medicalrecord.dto.LabOrderResponse;
import com.clinic.medicalrecord.dto.LabBillableItemsResponse;
import com.clinic.medicalrecord.dto.RecordLabResultRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;

import java.util.List;
import java.util.UUID;

public interface LabOrderService {
    LabOrderResponse create(CurrentUserPrincipal principal, String authorization, UUID recordId,
                            CreateLabOrderRequest request);

    LabOrderResponse create(CurrentUserPrincipal principal, String authorization, UUID recordId,
                            String idempotencyKey, CreateLabOrderRequest request);

    List<LabOrderResponse> list(CurrentUserPrincipal principal, String authorization, UUID recordId);

    /** Read-only billing lock state for the authenticated treating doctor; no billing item details. */
    boolean isBillingFinalized(CurrentUserPrincipal principal, String authorization, UUID recordId);

    LabOrderResponse get(CurrentUserPrincipal principal, String authorization, UUID orderId);

    LabOrderResponse collect(CurrentUserPrincipal principal, String authorization, UUID orderId,
                             CollectLabSampleRequest request);

    LabOrderResponse startProcessing(CurrentUserPrincipal principal, String authorization, UUID orderId);

    LabOrderResponse recordResult(CurrentUserPrincipal principal, String authorization, UUID orderId,
                                  RecordLabResultRequest request);

    LabOrderResponse release(CurrentUserPrincipal principal, String authorization, UUID orderId);

    LabBillableItemsResponse billableItems(CurrentUserPrincipal principal, UUID appointmentId);

    LabBillableItemsResponse finalizeBilling(CurrentUserPrincipal principal, String authorization, UUID appointmentId);
}
