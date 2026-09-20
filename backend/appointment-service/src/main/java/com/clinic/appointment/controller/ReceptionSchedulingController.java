package com.clinic.appointment.controller;

import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateReceptionAppointmentRequest;
import com.clinic.appointment.dto.RescheduleReceptionAppointmentRequest;
import com.clinic.appointment.service.ReceptionSchedulingService;
import com.clinic.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments/reception")
@PreAuthorize("hasAnyRole('ADMIN', 'RECEPTIONIST')")
@RequiredArgsConstructor
public class ReceptionSchedulingController {
    private final ReceptionSchedulingService service;

    @PostMapping("/bookings")
    public ApiResponse<AppointmentResponse> book(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                  @Valid @RequestBody CreateReceptionAppointmentRequest request) {
        return ApiResponse.success("Appointment booked by receptionist", service.book(authorization, request));
    }

    @PatchMapping("/{id}/reschedule")
    public ApiResponse<AppointmentResponse> reschedule(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                        @PathVariable UUID id,
                                                        @Valid @RequestBody RescheduleReceptionAppointmentRequest request) {
        return ApiResponse.success("Appointment rescheduled", service.reschedule(authorization, id, request));
    }

    @PatchMapping("/{id}/cancel")
    public ApiResponse<AppointmentResponse> cancel(@PathVariable UUID id) {
        return ApiResponse.success("Appointment cancelled", service.cancel(id));
    }

    @GetMapping("/bookings")
    public ApiResponse<List<AppointmentResponse>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID doctorId) {
        return ApiResponse.success("Appointments retrieved", service.list(date, doctorId));
    }
}