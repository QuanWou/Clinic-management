package com.clinic.identity.controller;

import com.clinic.common.dto.ApiResponse;
import com.clinic.identity.dto.DoctorNameResponse;
import com.clinic.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Only active DOCTOR account names, never general account details or medical records. */
@RestController
@RequestMapping("/api/users/doctors")
@RequiredArgsConstructor
public class DoctorDirectoryController {
    private final UserRepository users;

    @GetMapping("/names")
    @PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST', 'PATIENT', 'DOCTOR')")
    public ApiResponse<List<DoctorNameResponse>> names() {
        return ApiResponse.success("Active doctor names retrieved", users.findActiveDoctorAccounts());
    }
}