package com.clinic.catalog.controller;

import com.clinic.catalog.dto.*;
import com.clinic.catalog.service.CatalogService;
import com.clinic.common.dto.ApiResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
    private final CatalogService service;

    public CatalogController(CatalogService service) {
        this.service = service;
    }

    @GetMapping("/services")
    public ApiResponse<List<CatalogServiceResponse>> services() {
        return ApiResponse.success(service.services());
    }

    @GetMapping("/services/{id}")
    public ApiResponse<CatalogServiceResponse> service(@PathVariable UUID id) {
        return ApiResponse.success(service.service(id));
    }

    @GetMapping("/services/{id}/prices")
    public ApiResponse<List<PriceResponse>> priceHistory(@PathVariable UUID id) {
        return ApiResponse.success(service.priceHistory(id));
    }

    @GetMapping("/services/{id}/price")
    public ApiResponse<PriceResponse> effectivePrice(@PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate on) {
        return ApiResponse.success(service.priceOn(id, on));
    }

    @GetMapping("/medicines")
    public ApiResponse<List<MedicineResponse>> medicines() {
        return ApiResponse.success(service.medicines());
    }

    @GetMapping("/medicines/{id}")
    public ApiResponse<MedicineResponse> medicine(@PathVariable UUID id) {
        return ApiResponse.success(service.medicine(id));
    }
}