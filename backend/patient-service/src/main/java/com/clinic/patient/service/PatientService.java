package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.dto.PatientRecipientResponse;
import com.clinic.patient.dto.UpdatePatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;
import java.util.List;

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
        // An existing walk-in patient is a valid profile even without an Identity account.
        // Null is an explicit "no account" result; missing patients still return 404.
        return new PatientRecipientResponse(patient.getId(), patient.getUserId());
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
