package com.clinic.medicalrecord.service;

import com.clinic.medicalrecord.dto.CreateMedicalRecordRequest;
import com.clinic.medicalrecord.dto.MedicalRecordResponse;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.UUID;

public interface MedicalRecordService {

    MedicalRecordResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateMedicalRecordRequest request);

    MedicalRecordResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID medicalRecordId);

    List<MedicalRecordResponse> getMyRecords(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal);

    List<MedicalRecordResponse> getByPatientId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID patientId);

    List<MedicalRecordResponse> getByPatientCode(UUID currentUserId, String authorizationHeader,
                                                 CurrentUserPrincipal principal, String patientCode);

    Page<MedicalRecordResponse> getMyDoctorRecords(UUID currentUserId, String authorizationHeader,
                                                    CurrentUserPrincipal principal, int page, int size);
}
