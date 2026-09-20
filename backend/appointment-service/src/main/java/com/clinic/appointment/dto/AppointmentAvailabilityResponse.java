package com.clinic.appointment.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record AppointmentAvailabilityResponse(UUID doctorId, LocalDate date, LocalTime startTime,
                                              LocalTime endTime, boolean available) {
}