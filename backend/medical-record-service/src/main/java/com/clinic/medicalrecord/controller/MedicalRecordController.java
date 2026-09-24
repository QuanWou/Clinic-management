package com.clinic.medicalrecord.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.medicalrecord.dto.FinalizeMedicalRecordRequest;
import com.clinic.medicalrecord.dto.MedicalRecordResponse;
import com.clinic.medicalrecord.dto.SaveMedicalRecordDraftRequest;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.MedicalRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/medical-records")
@RequiredArgsConstructor
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    @GetMapping("/appointments/{appointmentId}")
    public ApiResponse<MedicalRecordResponse> getByAppointment(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable UUID appointmentId
    ) {
        return ApiResponse.success(
                "Medical record fetched successfully",
                medicalRecordService.getByAppointment(principal.id(), authorizationHeader, principal, appointmentId)
        );
    }

    @PutMapping("/appointments/{appointmentId}/draft")
    public ApiResponse<MedicalRecordResponse> saveDraft(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable UUID appointmentId,
            @Valid @RequestBody SaveMedicalRecordDraftRequest request
    ) {
        return ApiResponse.success(
                "Medical record draft saved",
                medicalRecordService.saveDraft(principal.id(), authorizationHeader, principal, appointmentId, request)
        );
    }

    @PostMapping("/{id}/finalize")
    public ApiResponse<MedicalRecordResponse> finalizeRecord(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable UUID id,
            @Valid @RequestBody FinalizeMedicalRecordRequest request
    ) {
        return ApiResponse.success(
                "Medical record finalized",
                medicalRecordService.finalizeRecord(principal.id(), authorizationHeader, principal, id, request)
        );
    }

    @GetMapping("/my")
    public ApiResponse<List<MedicalRecordResponse>> getMyRecords(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader
    ) {
        return ApiResponse.success(
                "Medical records fetched successfully",
                medicalRecordService.getMyRecords(principal.id(), authorizationHeader, principal)
        );
    }

    @GetMapping("/patients/{patientId}")
    public ApiResponse<List<MedicalRecordResponse>> getByPatientId(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable UUID patientId
    ) {
        return ApiResponse.success(
                "Patient medical records fetched successfully",
                medicalRecordService.getByPatientId(principal.id(), authorizationHeader, principal, patientId)
        );
    }

    /** Stable bounded directory contract: records only for the authenticated treating doctor. */
    @GetMapping("/doctor/my")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<DoctorRecordPage> getMyDoctorRecords(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size
    ) {
        Page<MedicalRecordResponse> records = medicalRecordService.getMyDoctorRecords(
                principal.id(), authorizationHeader, principal, page, size);
        return ApiResponse.success("Doctor medical records fetched successfully", new DoctorRecordPage(
                records.getContent(), records.getTotalElements(), records.getTotalPages(),
                records.getNumber(), records.getSize()));
    }

    public record DoctorRecordPage(List<MedicalRecordResponse> content, long totalElements,
                                   int totalPages, int number, int size) {}

    /** Resolve a visible BN chart number only within the authenticated doctor's finalized records. */
    @GetMapping("/doctor/patients/code/{patientCode}")
    @PreAuthorize("hasRole('DOCTOR')")
    public ApiResponse<List<MedicalRecordResponse>> getDoctorPatientByCode(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable String patientCode) {
        return ApiResponse.success(medicalRecordService.getByPatientCode(
                principal.id(), authorizationHeader, principal, patientCode));
    }

    @GetMapping("/{id}")
    public ApiResponse<MedicalRecordResponse> getById(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorizationHeader,
            @PathVariable UUID id
    ) {
        return ApiResponse.success(
                "Medical record fetched successfully",
                medicalRecordService.getById(principal.id(), authorizationHeader, principal, id)
        );
    }
}