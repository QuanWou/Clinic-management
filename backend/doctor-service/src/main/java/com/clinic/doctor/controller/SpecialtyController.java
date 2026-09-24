package com.clinic.doctor.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.doctor.dto.SpecialtyRequest;
import com.clinic.doctor.dto.SpecialtyResponse;
import com.clinic.doctor.security.CurrentUserPrincipal;
import com.clinic.doctor.service.AdminDoctorService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/specialties")
public class SpecialtyController {
    private final AdminDoctorService service;

    public SpecialtyController(AdminDoctorService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SpecialtyResponse>> list() {
        return ApiResponse.success(service.specialties());
    }

    @GetMapping("/{id}")
    public ApiResponse<SpecialtyResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.specialty(id));
    }

    @PostMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SpecialtyResponse> create(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @Valid @RequestBody SpecialtyRequest request) {
        return ApiResponse.success("Specialty created", service.createSpecialty(principal.id(), request));
    }

    @PutMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<SpecialtyResponse> update(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                                  @PathVariable UUID id, @Valid @RequestBody SpecialtyRequest request) {
        return ApiResponse.success("Specialty updated", service.updateSpecialty(principal.id(), id, request));
    }

    @DeleteMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@AuthenticationPrincipal CurrentUserPrincipal principal,
                                     @PathVariable UUID id) {
        service.deleteSpecialty(principal.id(), id);
        return ApiResponse.success("Specialty deleted", null);
    }
}