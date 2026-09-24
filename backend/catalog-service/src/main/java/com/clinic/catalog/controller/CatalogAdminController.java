package com.clinic.catalog.controller;

import com.clinic.catalog.dto.*;
import com.clinic.catalog.service.CatalogService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/catalog/admin")
@PreAuthorize("hasRole('ADMIN')")
public class CatalogAdminController {
    private final CatalogService service;

    public CatalogAdminController(CatalogService service) {
        this.service = service;
    }

    @GetMapping("/services")
    public ApiResponse<List<CatalogServiceResponse>> listAllServices() {
        return ApiResponse.success(service.allServices());
    }

    @GetMapping("/medicines")
    public ApiResponse<List<MedicineResponse>> listAllMedicines() {
        return ApiResponse.success(service.allMedicines());
    }

    @PostMapping("/services")
    public ApiResponse<CatalogServiceResponse> createService(@AuthenticationPrincipal UUID actor,
            @Valid @RequestBody CatalogServiceRequest request) {
        return ApiResponse.success("Service created", service.createService(actor, request));
    }

    @PutMapping("/services/{id}")
    public ApiResponse<CatalogServiceResponse> updateService(@AuthenticationPrincipal UUID actor,
            @PathVariable UUID id, @Valid @RequestBody CatalogServiceRequest request) {
        return ApiResponse.success("Service updated", service.updateService(actor, id, request));
    }

    @DeleteMapping("/services/{id}")
    public ApiResponse<CatalogServiceResponse> deactivateService(@AuthenticationPrincipal UUID actor,
            @PathVariable UUID id) {
        return ApiResponse.success("Service deactivated", service.deactivateService(actor, id));
    }

    @PostMapping("/services/{id}/prices")
    public ApiResponse<PriceResponse> publishPrice(@AuthenticationPrincipal UUID actor,
            @PathVariable UUID id, @Valid @RequestBody PublishPriceRequest request) {
        return ApiResponse.success("Price published", service.publishPrice(actor, id, request));
    }

    @PostMapping("/medicines")
    public ApiResponse<MedicineResponse> createMedicine(@AuthenticationPrincipal UUID actor,
            @Valid @RequestBody MedicineRequest request) {
        return ApiResponse.success("Medicine created", service.createMedicine(actor, request));
    }

    @PutMapping("/medicines/{id}")
    public ApiResponse<MedicineResponse> updateMedicine(@AuthenticationPrincipal UUID actor,
            @PathVariable UUID id, @Valid @RequestBody MedicineRequest request) {
        return ApiResponse.success("Medicine updated", service.updateMedicine(actor, id, request));
    }

    @DeleteMapping("/medicines/{id}")
    public ApiResponse<MedicineResponse> deactivateMedicine(@AuthenticationPrincipal UUID actor,
            @PathVariable UUID id) {
        return ApiResponse.success("Medicine deactivated", service.deactivateMedicine(actor, id));
    }
}