package com.clinic.doctor.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.doctor.dto.SpecialtyResponse;
import com.clinic.doctor.service.SpecialtyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/specialties")
public class SpecialtyController {

    private final SpecialtyService specialtyService;

    public SpecialtyController(SpecialtyService specialtyService) {
        this.specialtyService = specialtyService;
    }

    @GetMapping
    public ApiResponse<List<SpecialtyResponse>> getSpecialties() {
        return ApiResponse.success("Specialties retrieved successfully", specialtyService.getSpecialties());
    }
}
