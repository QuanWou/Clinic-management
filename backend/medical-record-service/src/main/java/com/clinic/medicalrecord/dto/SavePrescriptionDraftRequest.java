package com.clinic.medicalrecord.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SavePrescriptionDraftRequest(
        Long version,
        @Valid @Size(max = 50) List<PrescriptionItemDraftRequest> items
) {
}
