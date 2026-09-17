package com.clinic.doctor.dto;

import java.time.LocalTime;
import java.util.UUID;

public record DoctorAvailabilityResponse(
        UUID doctorId,
        boolean available,
        Integer dayOfWeek,
        LocalTime startTime,
        LocalTime endTime
) {
}
