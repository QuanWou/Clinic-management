package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.AppointmentResponse;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.CreateMedicalRecordRequest;
import com.clinic.medicalrecord.dto.MedicalRecordResponse;
import com.clinic.medicalrecord.dto.PrescriptionItemRequest;
import com.clinic.medicalrecord.dto.PrescriptionItemResponse;
import com.clinic.medicalrecord.dto.PrescriptionResponse;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.Prescription;
import com.clinic.medicalrecord.entity.PrescriptionItem;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.repository.MedicalRecordDisplayLookup;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.MedicalRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private static final String COMPLETED_STATUS = "COMPLETED";

    private final MedicalRecordRepository medicalRecordRepository;
    private final MedicalRecordDisplayLookup displayLookup;
    private final AppointmentClient appointmentClient;
    private final DoctorClient doctorClient;
    private final PatientClient patientClient;
    private final MedicalAuditService auditService;

    @Override
    @Transactional
    public MedicalRecordResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateMedicalRecordRequest request) {
        log.info("User {} is creating medical record for appointment {}", currentUserId, request.appointmentId());

        if (!principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can create medical records");
        }

        AppointmentResponse appointment = appointmentClient.getById(authorizationHeader, request.appointmentId());
        DoctorProfileResponse doctorProfile = doctorClient.getCurrentDoctorProfile(authorizationHeader);
        if (!appointment.doctorId().equals(doctorProfile.id())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to create medical record for this appointment");
        }
        // Authorize before disclosing the existence or lifecycle of a clinical record.
        if (medicalRecordRepository.existsByAppointmentId(request.appointmentId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medical record already exists for this appointment");
        }
        if (!COMPLETED_STATUS.equals(appointment.status())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Medical record can only be created for completed appointments");
        }

        MedicalRecord medicalRecord = MedicalRecord.builder()
                .appointmentId(appointment.id())
                .patientId(appointment.patientId())
                .doctorId(appointment.doctorId())
                .symptoms(request.symptoms())
                .diagnosis(request.diagnosis())
                .notes(request.notes())
                .build();

        if (request.prescriptionItems() != null && !request.prescriptionItems().isEmpty()) {
            Prescription prescription = Prescription.builder().build();
            request.prescriptionItems()
                    .stream()
                    .map(this::toPrescriptionItem)
                    .forEach(prescription::addItem);
            medicalRecord.addPrescription(prescription);
        }

        MedicalRecord saved = medicalRecordRepository.save(medicalRecord);
        auditService.recordMutation(currentUserId, "MEDICAL_RECORD_CREATED", saved.getId());
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID medicalRecordId) {
        log.info("Fetching medical record {} for user {}", medicalRecordId, currentUserId);
        MedicalRecord medicalRecord = getMedicalRecordById(medicalRecordId);
        authorizeRead(authorizationHeader, principal, medicalRecord);
        auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", medicalRecordId);
        if (principal.hasRole("DOCTOR")) {
            return toResponse(medicalRecord, displayLookup.forDoctor(medicalRecord.getDoctorId(),
                    List.of(medicalRecord.getId())).get(medicalRecord.getId()));
        }
        return toResponse(medicalRecord);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getMyRecords(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal) {
        log.info("Fetching medical records for current patient user {}", currentUserId);
        if (!principal.hasRole("PATIENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only patients can view their own medical records through this endpoint");
        }

        PatientProfileResponse patientProfile = patientClient.getCurrentPatientProfile(authorizationHeader);
        List<MedicalRecord> records = medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientProfile.id());
        records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
        return records.stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getByPatientId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID patientId) {
        log.info("Fetching medical records for patient {} by user {}", patientId, currentUserId);

        if (principal.hasRole("DOCTOR")) {
            UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
            List<MedicalRecord> records = medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctorId);
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
            throw new BusinessException(ErrorCode.FORBIDDEN, "No medical records assigned to this doctor for that patient");
        }
        List<MedicalRecord> records = medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctorId);
        if (records.isEmpty()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No medical records assigned to this doctor for that patient");
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
        // Resolve ownership from the authenticated doctor profile, never from a client-supplied doctor ID.
        if (!principal.hasRole("DOCTOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors can view their assigned medical records");
        }
        if (page < 0 || page > 100000 || size < 1 || size > 20) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid medical record page or size");
        }
        UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
        Page<MedicalRecord> records = medicalRecordRepository.findByDoctorId(doctorId,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        // Audit every record returned; a read audit failure must fail the response rather than silently skip it.
        records.forEach(record -> auditService.recordRead(currentUserId, "MEDICAL_RECORD_READ", record.getId()));
        Map<UUID, MedicalRecordDisplayLookup.Display> display = displayLookup.forDoctor(doctorId,
                records.stream().map(MedicalRecord::getId).toList());
        return records.map(record -> toResponse(record, display.get(record.getId())));
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
            UUID patientId = patientClient.getCurrentPatientProfile(authorizationHeader).id();
            if (medicalRecord.getPatientId().equals(patientId)) {
                return;
            }
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view this medical record");
    }

    private PrescriptionItem toPrescriptionItem(PrescriptionItemRequest request) {
        return PrescriptionItem.builder()
                .medicineName(request.medicineName())
                .dosage(request.dosage())
                .frequency(request.frequency())
                .duration(request.duration())
                .note(request.note())
                .build();
    }

    private MedicalRecordResponse toResponse(MedicalRecord medicalRecord) {
        return toResponse(medicalRecord, null);
    }

    private MedicalRecordResponse toResponse(MedicalRecord medicalRecord, MedicalRecordDisplayLookup.Display display) {
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
                display == null ? null : display.endTime()
        );
    }

    private PrescriptionResponse toPrescriptionResponse(Prescription prescription) {
        return new PrescriptionResponse(
                prescription.getId(),
                prescription.getItems().stream()
                        .map(this::toPrescriptionItemResponse)
                        .toList(),
                prescription.getCreatedAt()
        );
    }

    private PrescriptionItemResponse toPrescriptionItemResponse(PrescriptionItem item) {
        return new PrescriptionItemResponse(
                item.getId(),
                item.getMedicineName(),
                item.getDosage(),
                item.getFrequency(),
                item.getDuration(),
                item.getNote()
        );
    }
}
