package com.clinic.doctor.dto;

import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        Integer dayOfWeek,
        LocalTime startTime,
        LocalTime endTime
) {
}
