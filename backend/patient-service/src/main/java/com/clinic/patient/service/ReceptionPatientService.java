package com.clinic.patient.service;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.patient.dto.ReceptionPatientResponse;
import com.clinic.patient.dto.RegisterWalkInPatientRequest;
import com.clinic.patient.entity.Patient;
import com.clinic.patient.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
        Patient saved = repository.save(patient);
        repository.flush(); // Populate database-generated patientCode before responding.
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public ReceptionPatientResponse get(UUID id) {
        return toResponse(repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient not found")));
    }

    /** Resolve the public chart number within the same role-restricted reception API. */
    @Transactional(readOnly = true)
    public ReceptionPatientResponse getByCode(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > 24 || !normalized.matches("BN[0-9]{6,}")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid patient code");
        }
        return toResponse(repository.findByPatientCode(normalized)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Patient not found")));
    }

    /** Authorized staff directory: return one stable page instead of transferring all medical profiles. */
    @Transactional(readOnly = true)
    public Page<ReceptionPatientResponse> list(int page, int size) {
        if (page < 0 || size < 1 || size > 50) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Page must be nonnegative and size between 1 and 50");
        }
        return repository.findAll(PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .map(this::toResponse);
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
                patient.getPhone(), patient.getDob(), patient.getGender(), patient.getAddress(), patient.getBloodType(),
                patient.getPatientCode());
    }
}