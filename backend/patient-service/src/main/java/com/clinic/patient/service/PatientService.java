package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.PatientProfileResponse;
import com.clinic.patient.dto.UpdatePatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository patientRepository;

    public PatientService(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse getProfile(UUID userId) {
        Patient patient = patientRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient profile not found"));
        return toResponse(patient);
    }

    @Transactional
    public PatientProfileResponse updateProfile(UUID userId, UpdatePatientRequest request) {
        Patient patient = patientRepository.findByUserId(userId)
                .orElseGet(() -> Patient.builder().userId(userId).build());

        patient.setDob(request.dob());
        patient.setGender(request.gender());
        patient.setAddress(request.address());
        patient.setBloodType(request.bloodType());

        return toResponse(patientRepository.save(patient));
    }

    private PatientProfileResponse toResponse(Patient patient) {
        return new PatientProfileResponse(
                patient.getId(),
                patient.getUserId(),
                patient.getDob(),
                patient.getGender(),
                patient.getAddress(),
                patient.getBloodType(),
                patient.getUpdatedAt()
        );
    }
}
