package com.clinic.doctor.dto;

import jakarta.validation.constraints.*;

import java.time.LocalTime;

public record ScheduleRequest(
        @NotNull @Min(1) @Max(7) Integer dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime
) {
}