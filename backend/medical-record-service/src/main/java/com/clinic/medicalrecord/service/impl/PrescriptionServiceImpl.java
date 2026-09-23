package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.CatalogClient;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.EncounterContextResponse;
import com.clinic.medicalrecord.dto.PrescriptionItemDraftRequest;
import com.clinic.medicalrecord.dto.PrescriptionItemResponse;
import com.clinic.medicalrecord.dto.PrescriptionResponse;
import com.clinic.medicalrecord.dto.SavePrescriptionDraftRequest;
import com.clinic.medicalrecord.dto.SignPrescriptionRequest;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.MedicalRecordStatus;
import com.clinic.medicalrecord.entity.Prescription;
import com.clinic.medicalrecord.entity.PrescriptionItem;
import com.clinic.medicalrecord.entity.PrescriptionStatus;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.repository.PrescriptionRepository;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.PrescriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PrescriptionServiceImpl implements PrescriptionService {

    private static final String IN_PROGRESS = "IN_PROGRESS";

    private final PrescriptionRepository prescriptions;
    private final MedicalRecordRepository records;
    private final DoctorClient doctors;
    private final AppointmentClient appointments;
    private final CatalogClient catalog;
    private final MedicalAuditService audit;

    @Override
    @Transactional(readOnly = true)
    public List<PrescriptionResponse> list(CurrentUserPrincipal principal, String authorization, UUID recordId) {
        MedicalRecord record = requireEditableRelationship(principal, authorization, recordId, false);
        return prescriptions.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId())
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public PrescriptionResponse saveDraft(CurrentUserPrincipal principal, String authorization, UUID recordId,
                                          SavePrescriptionDraftRequest request) {
        MedicalRecord record = requireEditableRelationship(principal, authorization, recordId, true);
        if (record.getStatus() != MedicalRecordStatus.DRAFT) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescriptions can only be edited while the medical record is a draft");
        }

        Prescription prescription = prescriptions
                .findFirstByMedicalRecordIdAndStatusOrderByCreatedAtDesc(recordId, PrescriptionStatus.DRAFT)
                .orElse(null);
        if (prescription == null) {
            if (request.version() != null) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "New prescription draft must not provide an existing version");
            }
            prescription = Prescription.builder()
                    .medicalRecord(record)
                    .status(PrescriptionStatus.DRAFT)
                    .build();
        } else if (!Objects.equals(prescription.getVersion(), request.version())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescription changed in another session; reload before saving");
        }

        List<PrescriptionItem> items = request.items() == null ? List.of()
                : request.items().stream().map(item -> toItem(authorization, item)).toList();
        prescription.replaceItems(items);
        prescription.setStatus(PrescriptionStatus.DRAFT);
        prescription.setSignedAt(null);
        prescription.setSignedBy(null);

        try {
            Prescription saved = prescriptions.saveAndFlush(prescription);
            audit.recordMutation(principal.id(), "PRESCRIPTION_DRAFT_SAVED", saved.getId());
            return toResponse(saved);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescription changed in another session; reload before saving");
        }
    }

    @Override
    @Transactional
    public PrescriptionResponse sign(CurrentUserPrincipal principal, String authorization, UUID recordId,
                                     UUID prescriptionId, SignPrescriptionRequest request) {
        MedicalRecord record = requireEditableRelationship(principal, authorization, recordId, true);
        if (record.getStatus() != MedicalRecordStatus.DRAFT) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescription must be signed before the medical record is finalized");
        }
        Prescription prescription = prescriptions.findById(prescriptionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Prescription not found"));
        if (!recordId.equals(prescription.getMedicalRecord().getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Prescription does not belong to this medical record");
        }
        if (prescription.getStatus() == PrescriptionStatus.SIGNED) {
            return toResponse(prescription);
        }
        if (!Objects.equals(prescription.getVersion(), request.version())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescription changed in another session; reload before signing");
        }
        if (prescription.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "At least one medicine is required before signing a prescription");
        }

        prescription.setStatus(PrescriptionStatus.SIGNED);
        prescription.setSignedAt(LocalDateTime.now());
        prescription.setSignedBy(principal.id());
        try {
            Prescription saved = prescriptions.saveAndFlush(prescription);
            audit.recordMutation(principal.id(), "PRESCRIPTION_SIGNED", saved.getId());
            return toResponse(saved);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Prescription changed in another session; reload before signing");
        }
    }

    private MedicalRecord requireEditableRelationship(CurrentUserPrincipal principal, String authorization,
                                                      UUID recordId, boolean requireInProgress) {
        if (principal == null || !principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can manage prescriptions");
        }
        MedicalRecord record = records.findById(recordId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
        UUID doctorId = doctors.getCurrentDoctorProfile(authorization).id();
        if (!record.getDoctorId().equals(doctorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to manage this prescription");
        }
        if (requireInProgress) {
            EncounterContextResponse encounter = appointments.getEncounterContext(authorization, record.getAppointmentId());
            if (!record.getDoctorId().equals(encounter.doctorId())
                    || !record.getPatientId().equals(encounter.patientId())
                    || !IN_PROGRESS.equals(encounter.queueStatus())) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Prescription can only be edited during the assigned encounter");
            }
        }
        return record;
    }

    private PrescriptionItem toItem(String authorization, PrescriptionItemDraftRequest request) {
        CatalogClient.CatalogMedicine medicine = catalog.requireActiveMedicine(authorization, request.medicineId());
        return PrescriptionItem.builder()
                .medicineId(medicine.id())
                .medicineCode(medicine.code())
                .medicineName(medicine.name())
                .medicineUnit(medicine.unit())
                .dosage(request.dosage().trim())
                .frequency(request.frequency().trim())
                .duration(request.duration().trim())
                .route(normalize(request.route()))
                .quantity(request.quantity())
                .note(normalize(request.note()))
                .build();
    }

    private PrescriptionResponse toResponse(Prescription prescription) {
        return new PrescriptionResponse(
                prescription.getId(),
                prescription.getItems().stream().map(this::toItemResponse).toList(),
                prescription.getCreatedAt(),
                prescription.getStatus() == null ? PrescriptionStatus.SIGNED : prescription.getStatus(),
                prescription.getVersion(),
                prescription.getSignedAt(),
                prescription.getSignedBy()
        );
    }

    private PrescriptionItemResponse toItemResponse(PrescriptionItem item) {
        return new PrescriptionItemResponse(
                item.getId(),
                item.getMedicineId(),
                item.getMedicineCode(),
                item.getMedicineName(),
                item.getMedicineUnit(),
                item.getDosage(),
                item.getFrequency(),
                item.getDuration(),
                item.getRoute(),
                item.getQuantity(),
                item.getNote()
        );
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
