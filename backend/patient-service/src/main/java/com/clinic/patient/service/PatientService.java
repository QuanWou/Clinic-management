package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.InternalPatientSummaryResponse;
import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.dto.PatientRecipientResponse;
import com.clinic.patient.dto.UpdatePatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository patientRepository;

    public PatientService(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    @Transactional(readOnly = true)
    public List<PatientProfileResponse> listPatients() {
        return patientRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse getProfile(UUID userId) {
        Patient patient = patientRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found"));
        return toResponse(patient);
    }

    @Transactional(readOnly = true)
    public PatientRecipientResponse getRecipient(UUID patientId) {
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found"));
        return new PatientRecipientResponse(patient.getId(), patient.getUserId());
    }

    @Transactional(readOnly = true)
    public InternalPatientSummaryResponse getInternalSummary(UUID patientId) {
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found"));
        return toInternalSummary(patient);
    }

    @Transactional(readOnly = true)
    public List<InternalPatientSummaryResponse> getInternalSummaries(List<UUID> patientIds) {
        if (patientIds == null || patientIds.isEmpty()) {
            return List.of();
        }
        if (patientIds.size() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Patient summary request cannot exceed 100 IDs");
        }
        List<UUID> uniqueIds = patientIds.stream().distinct().toList();
        List<Patient> found = patientRepository.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "One or more patient profiles were not found");
        }
        return found.stream().map(this::toInternalSummary).toList();
    }

    @Transactional
    public PatientProfileResponse updateProfile(UUID userId, UpdatePatientRequest request) {
        Patient patient = patientRepository.findByUserId(userId)
                .orElseGet(() -> Patient.builder().userId(userId).build());

        patient.setDob(request.dob());
        patient.setGender(request.gender().trim().toUpperCase(Locale.ROOT));
        patient.setAddress(normalizeNullable(request.address()));
        patient.setBloodType(normalizeBloodType(request.bloodType()));

        Patient saved = patientRepository.save(patient);
        patientRepository.flush(); // Also handles first-time profile creation.
        return toResponse(saved);
    }

    private PatientProfileResponse toResponse(Patient patient) {
        return new PatientProfileResponse(
                patient.getId(),
                patient.getUserId(),
                patient.getDob(),
                patient.getGender(),
                patient.getAddress(),
                patient.getBloodType(),
                patient.getUpdatedAt(),
                patient.getPatientCode()
        );
    }

    private InternalPatientSummaryResponse toInternalSummary(Patient patient) {
        return new InternalPatientSummaryResponse(
                patient.getId(),
                patient.getFullName(),
                patient.getDob(),
                patient.getGender(),
                patient.getBloodType()
        );
    }

    private String normalizeBloodType(String bloodType) {
        String normalized = normalizeNullable(bloodType);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
