package com.clinic.doctor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateDoctorSchedulesRequest(
        @NotNull(message = "Schedules are required")
        @Size(max = 28, message = "A doctor can have at most 28 weekly schedule entries")
        List<@NotNull(message = "Schedule entry is required") @Valid DoctorScheduleRequest> schedules
) {
}
