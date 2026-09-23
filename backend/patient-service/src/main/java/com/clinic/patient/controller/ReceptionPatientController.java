package com.clinic.patient.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.patient.dto.ReceptionPatientResponse;
import com.clinic.patient.dto.RegisterWalkInPatientRequest;
import com.clinic.patient.service.ReceptionPatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients/reception")
@PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
@RequiredArgsConstructor
public class ReceptionPatientController {

    private final ReceptionPatientService service;

    @PostMapping
    public ApiResponse<ReceptionPatientResponse> register(@Valid @RequestBody RegisterWalkInPatientRequest request) {
        return ApiResponse.success("Patient registered", service.register(request));
    }

    @GetMapping("/list")
    public ApiResponse<DirectoryPage> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<ReceptionPatientResponse> result = service.list(page, size);
        return ApiResponse.success("Patient directory retrieved", new DirectoryPage(
                result.getContent(), result.getTotalElements(), result.getTotalPages(),
                result.getNumber(), result.getSize()));
    }

    /** Explicit stable JSON contract; avoid Spring Data PageImpl's unstable serialization shape. */
    public record DirectoryPage(List<ReceptionPatientResponse> content, long totalElements,
                                int totalPages, int number, int size) {}

    @GetMapping
    public ApiResponse<List<ReceptionPatientResponse>> search(
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String name) {
        return ApiResponse.success("Patients retrieved", service.search(phone, name));
    }

    @GetMapping("/code/{patientCode}")
    public ApiResponse<ReceptionPatientResponse> getByCode(@PathVariable String patientCode) {
        return ApiResponse.success("Patient retrieved", service.getByCode(patientCode));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReceptionPatientResponse> get(@PathVariable UUID id) {
        return ApiResponse.success("Patient retrieved", service.get(id));
    }
}