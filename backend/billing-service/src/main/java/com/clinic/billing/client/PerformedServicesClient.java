package com.clinic.billing.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Appointment currently has no authoritative performed-service IDs or finalized billable-list API.
 * Replace this adapter only after Task 03 publishes a verified, role-protected contract.
 * Never infer a catalog ID from the doctor, appointment or a frontend selection.
 */
@Component
public class PerformedServicesClient {
    public PerformedServices get(String authorization, UUID appointmentId) {
        throw new BusinessException(ErrorCode.CONFLICT,
                "Invoice cannot be issued: appointment has no authoritative finalized performed-service contract");
    }

    public record PerformedServices(UUID appointmentId, boolean finalized, String revision, List<PerformedItem> items) {}
    public record PerformedItem(UUID performedItemId, UUID serviceId, int quantity, LocalDate serviceDate) {}
}