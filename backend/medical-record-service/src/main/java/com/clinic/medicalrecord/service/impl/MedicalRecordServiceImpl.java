package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.EncounterContextResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.FinalizeMedicalRecordRequest;
import com.clinic.medicalrecord.dto.MedicalRecordResponse;
import com.clinic.medicalrecord.dto.PrescriptionItemResponse;
import com.clinic.medicalrecord.dto.PrescriptionResponse;
import com.clinic.medicalrecord.dto.SaveMedicalRecordDraftRequest;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.MedicalRecordStatus;
import com.clinic.medicalrecord.entity.Prescription;
import com.clinic.medicalrecord.entity.PrescriptionItem;
import com.clinic.medicalrecord.entity.PrescriptionStatus;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.repository.MedicalRecordDisplayLookup;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.MedicalRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private static final String IN_PROGRESS_STATUS = "IN_PROGRESS";

    private final MedicalRecordRepository medicalRecordRepository;
    private final MedicalRecordDisplayLookup displayLookup;
    private final AppointmentClient appointmentClient;
    private final DoctorClient doctorClient;
    private final PatientClient patientClient;
    private final MedicalAuditService auditService;

    @Transactional(readOnly = true)
    public MedicalRecordResponse getById(UUID currentUserId, String authorizationHeader,
                                         CurrentUserPrincipal principal, UUID medicalRecordId) {
        MedicalRecord medicalRecord = getMedicalRecordById(medicalRecordId);
        authorizeRead(authorizationHeader, principal, medicalRecord);
        auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", medicalRecordId);
        if (principal.hasRole("DOCTOR")) {
            MedicalRecordDisplayLookup.Display display = displayLookup.forDoctor(medicalRecord.getDoctorId(),
                    List.of(medicalRecord.getId())).get(medicalRecord.getId());
            return toResponse(medicalRecord, display);
        }
        return toResponse(medicalRecord);
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getByAppointment(UUID currentUserId, String authorizationHeader,
                                                  CurrentUserPrincipal principal, UUID appointmentId) {
        requireDoctor(principal);
        EncounterContextResponse encounter = requireOwnedEncounter(authorizationHeader, appointmentId);
        MedicalRecord record = medicalRecordRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
        if (!record.getPatientId().equals(encounter.patientId()) || !record.getDoctorId().equals(encounter.doctorId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medical record does not match encounter");
        }
        auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId());
        return toResponse(record);
    }

    @Override
    @Transactional
    public MedicalRecordResponse saveDraft(UUID currentUserId, String authorizationHeader,
                                           CurrentUserPrincipal principal, UUID appointmentId,
                                           SaveMedicalRecordDraftRequest request) {
        requireDoctor(principal);
        EncounterContextResponse encounter = requireOwnedEncounter(authorizationHeader, appointmentId);
        if (!IN_PROGRESS_STATUS.equals(encounter.queueStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Medical record draft can only be edited while the visit is in progress");
        }

        MedicalRecord record = medicalRecordRepository.findByAppointmentId(appointmentId).orElse(null);
        if (record == null) {
            if (request.version() != null) {
                throw new BusinessException(ErrorCode.CONFLICT, "New draft must not provide an existing version");
            }
            record = MedicalRecord.builder()
                    .appointmentId(encounter.appointmentId())
                    .patientId(encounter.patientId())
                    .doctorId(encounter.doctorId())
                    .status(MedicalRecordStatus.DRAFT)
                    .build();
        } else {
            verifyRecordMatchesEncounter(record, encounter);
            if (record.getStatus() == MedicalRecordStatus.FINAL) {
                throw new BusinessException(ErrorCode.CONFLICT, "Finalized medical record cannot be edited");
            }
            if (!Objects.equals(record.getVersion(), request.version())) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Medical record changed in another session; reload before saving");
            }
        }

        record.setSymptoms(normalizeNullable(request.symptoms()));
        record.setDiagnosis(normalizeNullable(request.diagnosis()));
        record.setNotes(normalizeNullable(request.notes()));
        record.setStatus(MedicalRecordStatus.DRAFT);
        record.setFinalizedAt(null);
        record.setFinalizedBy(null);

        try {
            MedicalRecord saved = medicalRecordRepository.saveAndFlush(record);
            auditService.recordMutation(currentUserId, "MEDICAL_RECORD_DRAFT_SAVED", saved.getId());
            return toResponse(saved);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Medical record changed in another session; reload before saving");
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "A medical record already exists for this appointment; reload before saving");
        }
    }

    @Override
    @Transactional
    public MedicalRecordResponse finalizeRecord(UUID currentUserId, String authorizationHeader,
                                                CurrentUserPrincipal principal, UUID medicalRecordId,
                                                FinalizeMedicalRecordRequest request) {
        requireDoctor(principal);
        MedicalRecord record = getMedicalRecordById(medicalRecordId);
        DoctorProfileResponse doctorProfile = doctorClient.getCurrentDoctorProfile(authorizationHeader);
        if (!record.getDoctorId().equals(doctorProfile.id())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to finalize this medical record");
        }
        if (record.getStatus() == MedicalRecordStatus.FINAL) {
            return toResponse(record);
        }

        EncounterContextResponse encounter = requireOwnedEncounter(authorizationHeader, record.getAppointmentId());
        verifyRecordMatchesEncounter(record, encounter);
        if (!IN_PROGRESS_STATUS.equals(encounter.queueStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Medical record can only be finalized while the visit is in progress");
        }
        if (!Objects.equals(record.getVersion(), request.version())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Medical record changed in another session; reload before finalizing");
        }
        if (record.getDiagnosis() == null || record.getDiagnosis().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Diagnosis is required before finalizing the medical record");
        }
        if (record.getPrescriptions().stream().anyMatch(p -> p.getStatus() == PrescriptionStatus.DRAFT)) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Sign or remove the prescription draft before finalizing the medical record");
        }

        record.setDiagnosis(record.getDiagnosis().trim());
        record.setStatus(MedicalRecordStatus.FINAL);
        record.setFinalizedAt(LocalDateTime.now());
        record.setFinalizedBy(currentUserId);

        try {
            MedicalRecord saved = medicalRecordRepository.saveAndFlush(record);
            auditService.recordMutation(currentUserId, "MEDICAL_RECORD_FINALIZED", saved.getId());
            return toResponse(saved);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Medical record changed in another session; reload before finalizing");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getMyRecords(UUID currentUserId, String authorizationHeader,
                                                    CurrentUserPrincipal principal) {
        if (!principal.hasRole("PATIENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Only patients can view their own medical records through this endpoint");
        }

        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
        List<MedicalRecord> records = medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientProfile.id())
                .stream()
                .filter(record -> record.getStatus() == null || record.getStatus() == MedicalRecordStatus.FINAL)
                .toList();
        records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
        return records.stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getByPatientId(UUID currentUserId, String authorizationHeader,
                                                      CurrentUserPrincipal principal, UUID patientId) {
        if (principal.hasRole("DOCTOR")) {
            UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
            List<MedicalRecord> records = medicalRecordRepository
                    .findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(
                            patientId, doctorId, MedicalRecordStatus.FINAL);
            if (records.isEmpty()) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view patient medical records");
            }
            records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
            Map<UUID, MedicalRecordDisplayLookup.Display> display = displayLookup.forDoctor(doctorId,
                    records.stream().map(MedicalRecord::getId).toList());
            return records.stream().map(record -> toResponse(record, display.get(record.getId()))).toList();
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view patient medical records");
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getByPatientCode(UUID currentUserId, String authorizationHeader,
                                                        CurrentUserPrincipal principal, String patientCode) {
        if (!principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only treating doctors can search medical records");
        }
        if (patientCode == null || !patientCode.matches("BN[0-9]{6,}")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid patient code");
        }
        UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
        UUID patientId = displayLookup.patientIdForDoctorCode(doctorId, patientCode);
        if (patientId == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "No medical records assigned to this doctor for that patient");
        }
        List<MedicalRecord> records = medicalRecordRepository
                .findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(
                        patientId, doctorId, MedicalRecordStatus.FINAL);
        if (records.isEmpty()) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "No finalized medical records assigned to this doctor for that patient");
        }
        records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
        Map<UUID, MedicalRecordDisplayLookup.Display> display = displayLookup.forDoctor(doctorId,
                records.stream().map(MedicalRecord::getId).toList());
        return records.stream().map(record -> toResponse(record, display.get(record.getId()))).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> getMyDoctorRecords(UUID currentUserId, String authorizationHeader,
                                                          CurrentUserPrincipal principal, int page, int size) {
        if (!principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Only doctors can view their assigned medical records");
        }
        if (page < 0 || page > 100000 || size < 1 || size > 20) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid medical record page or size");
        }
        UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
        Page<MedicalRecord> records = medicalRecordRepository.findByDoctorIdAndStatus(
                doctorId, MedicalRecordStatus.FINAL,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
        Map<UUID, MedicalRecordDisplayLookup.Display> display = displayLookup.forDoctor(doctorId,
                records.stream().map(MedicalRecord::getId).toList());
        return records.map(record -> toResponse(record, display.get(record.getId())));
    }

    private void requireDoctor(CurrentUserPrincipal principal) {
        if (principal == null || !principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can modify medical records");
        }
    }

    private EncounterContextResponse requireOwnedEncounter(String authorizationHeader, UUID appointmentId) {
        EncounterContextResponse encounter = appointmentClient.getEncounterContext(authorizationHeader, appointmentId);
        DoctorProfileResponse doctorProfile = doctorClient.getCurrentDoctorProfile(authorizationHeader);
        if (!encounter.doctorId().equals(doctorProfile.id())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized for this encounter");
        }
        return encounter;
    }

    private void verifyRecordMatchesEncounter(MedicalRecord record, EncounterContextResponse encounter) {
        if (!record.getAppointmentId().equals(encounter.appointmentId())
                || !record.getPatientId().equals(encounter.patientId())
                || !record.getDoctorId().equals(encounter.doctorId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medical record does not match encounter");
        }
    }

    private MedicalRecord getMedicalRecordById(UUID medicalRecordId) {
        return medicalRecordRepository.findById(medicalRecordId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
    }

    private void authorizeRead(String authorizationHeader, CurrentUserPrincipal principal, MedicalRecord medicalRecord) {
        if (principal.hasRole("DOCTOR")) {
            UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
            if (medicalRecord.getDoctorId().equals(doctorId)) {
                return;
            }
        }

        if (principal.hasRole("PATIENT")) {
            if (medicalRecord.getStatus() != null && medicalRecord.getStatus() != MedicalRecordStatus.FINAL) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Draft medical records are not visible to patients");
            }
            UUID patientId = patientClient.getCurrentPatientProfile(authorizationHeader).id();
            if (medicalRecord.getPatientId().equals(patientId)) {
                return;
            }
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view this medical record");
    }

    private MedicalRecordResponse toResponse(MedicalRecord medicalRecord) {
        return toResponse(medicalRecord, null);
    }

    private MedicalRecordResponse toResponse(MedicalRecord medicalRecord,
                                             MedicalRecordDisplayLookup.Display display) {
        MedicalRecordStatus status = medicalRecord.getStatus() == null
                ? MedicalRecordStatus.FINAL
                : medicalRecord.getStatus();
        return new MedicalRecordResponse(
                medicalRecord.getId(),
                medicalRecord.getAppointmentId(),
                medicalRecord.getPatientId(),
                medicalRecord.getDoctorId(),
                medicalRecord.getSymptoms(),
                medicalRecord.getDiagnosis(),
                medicalRecord.getNotes(),
                medicalRecord.getPrescriptions().stream()
                        .map(this::toPrescriptionResponse)
                        .toList(),
                medicalRecord.getCreatedAt(),
                medicalRecord.getUpdatedAt(),
                medicalRecord.getRecordCode(),
                display == null ? null : display.patientCode(),
                display == null ? null : display.patientName(),
                display == null ? null : display.doctorCode(),
                display == null ? null : display.doctorName(),
                display == null ? null : display.appointmentDate(),
                display == null ? null : display.startTime(),
                display == null ? null : display.endTime(),
                status,
                medicalRecord.getVersion(),
                medicalRecord.getFinalizedAt(),
                medicalRecord.getFinalizedBy()
        );
    }

    private PrescriptionResponse toPrescriptionResponse(Prescription prescription) {
        return new PrescriptionResponse(
                prescription.getId(),
                prescription.getItems().stream()
                        .map(this::toPrescriptionItemResponse)
                        .toList(),
                prescription.getCreatedAt(),
                prescription.getStatus() == null ? PrescriptionStatus.SIGNED : prescription.getStatus(),
                prescription.getVersion(),
                prescription.getSignedAt(),
                prescription.getSignedBy()
        );
    }

    private PrescriptionItemResponse toPrescriptionItemResponse(PrescriptionItem item) {
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

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
