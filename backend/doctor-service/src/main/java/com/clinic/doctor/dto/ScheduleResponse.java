package com.clinic.doctor.dto;

import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(UUID id, UUID doctorId, Integer dayOfWeek,
                               LocalTime startTime, LocalTime endTime) {
    public ScheduleResponse(UUID id, Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this(id, null, dayOfWeek, startTime, endTime);
    }
}
