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
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.MedicalRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private static final String COMPLETED_STATUS = "COMPLETED";

    private final MedicalRecordRepository medicalRecordRepository;
    private final AppointmentClient appointmentClient;
    private final DoctorClient doctorClient;
    private final PatientClient patientClient;

    @Override
    @Transactional
    public MedicalRecordResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateMedicalRecordRequest request) {
        log.info("User {} is creating medical record for appointment {}", currentUserId, request.appointmentId());

        if (!principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only doctors or admins can create medical records");
        }

        if (medicalRecordRepository.existsByAppointmentId(request.appointmentId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Medical record already exists for this appointment");
        }

        AppointmentResponse appointment = appointmentClient.getById(authorizationHeader, request.appointmentId());
        if (!COMPLETED_STATUS.equals(appointment.status())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Medical record can only be created for completed appointments");
        }

        if (principal.hasRole("DOCTOR") && !principal.hasRole("ADMIN")) {
            DoctorProfileResponse doctorProfile = doctorClient.getCurrentDoctorProfile(authorizationHeader);
            if (!appointment.doctorId().equals(doctorProfile.id())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to create medical record for this appointment");
            }
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

        return toResponse(medicalRecordRepository.save(medicalRecord));
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID medicalRecordId) {
        log.info("Fetching medical record {} for user {}", medicalRecordId, currentUserId);
        MedicalRecord medicalRecord = getMedicalRecordById(medicalRecordId);
        authorizeRead(authorizationHeader, principal, medicalRecord);
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
        return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientProfile.id())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicalRecordResponse> getByPatientId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID patientId) {
        log.info("Fetching medical records for patient {} by user {}", patientId, currentUserId);

        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST")) {
            return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                    .stream()
                    .map(this::toResponse)
                    .toList();
        }

        if (principal.hasRole("DOCTOR")) {
            UUID doctorId = doctorClient.getCurrentDoctorProfile(authorizationHeader).id();
            return medicalRecordRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                    .stream()
                    .filter(record -> record.getDoctorId().equals(doctorId))
                    .map(this::toResponse)
                    .toList();
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view patient medical records");
    }

    private MedicalRecord getMedicalRecordById(UUID medicalRecordId) {
        return medicalRecordRepository.findById(medicalRecordId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
    }

    private void authorizeRead(String authorizationHeader, CurrentUserPrincipal principal, MedicalRecord medicalRecord) {
        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST")) {
            return;
        }

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
                medicalRecord.getUpdatedAt()
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
