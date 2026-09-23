package com.clinic.medicalrecord.service;

import com.clinic.medicalrecord.dto.PrescriptionResponse;
import com.clinic.medicalrecord.dto.SavePrescriptionDraftRequest;
import com.clinic.medicalrecord.dto.SignPrescriptionRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;

import java.util.List;
import java.util.UUID;

public interface PrescriptionService {
    List<PrescriptionResponse> list(CurrentUserPrincipal principal, String authorization, UUID recordId);

    PrescriptionResponse saveDraft(CurrentUserPrincipal principal, String authorization, UUID recordId,
                                   SavePrescriptionDraftRequest request);

    PrescriptionResponse sign(CurrentUserPrincipal principal, String authorization, UUID recordId,
                              UUID prescriptionId, SignPrescriptionRequest request);
}
