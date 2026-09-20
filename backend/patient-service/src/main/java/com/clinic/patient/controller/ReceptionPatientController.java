package com.clinic.patient.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.patient.dto.ReceptionPatientResponse;
import com.clinic.patient.dto.RegisterWalkInPatientRequest;
import com.clinic.patient.service.ReceptionPatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

    @GetMapping
    public ApiResponse<List<ReceptionPatientResponse>> search(
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String name) {
        return ApiResponse.success("Patients retrieved", service.search(phone, name));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReceptionPatientResponse> get(@PathVariable UUID id) {
        return ApiResponse.success("Patient retrieved", service.get(id));
    }
}