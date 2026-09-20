package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.ReceptionPatientResponse;
import com.clinic.patient.dto.RegisterWalkInPatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReceptionPatientService {

    private final PatientRepository repository;

    @Transactional
    public ReceptionPatientResponse register(RegisterWalkInPatientRequest request) {
        Patient patient = Patient.builder()
                .fullName(request.fullName().trim())
                .phone(request.phone().trim())
                .dob(request.dob())
                .gender(request.gender())
                .address(request.address())
                .bloodType(request.bloodType())
                .build();
        return toResponse(repository.save(patient));
    }

    @Transactional(readOnly = true)
    public ReceptionPatientResponse get(UUID id) {
        return toResponse(repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient not found")));
    }

    @Transactional(readOnly = true)
    public List<ReceptionPatientResponse> search(String phone, String name) {
        String normalizedPhone = phone == null || phone.isBlank() ? null : phone.trim();
        String normalizedName = name == null || name.isBlank() ? null : "%" + name.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        if (normalizedName == null && normalizedPhone == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Provide a patient name or phone to search");
        }
        return repository.searchForReception(normalizedPhone, normalizedName, PageRequest.of(0, 50)).stream()
                .map(this::toResponse)
                .toList();
    }

    private ReceptionPatientResponse toResponse(Patient patient) {
        return new ReceptionPatientResponse(patient.getId(), patient.getUserId(), patient.getFullName(),
                patient.getPhone(), patient.getDob(), patient.getGender(), patient.getAddress(), patient.getBloodType());
    }
}