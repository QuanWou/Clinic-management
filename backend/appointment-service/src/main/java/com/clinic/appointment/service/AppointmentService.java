package com.clinic.appointment.service;

import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.AppointmentAvailabilityResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.security.CurrentUserPrincipal;

import java.util.List;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public interface AppointmentService {

    AppointmentResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateAppointmentRequest request);

    List<AppointmentResponse> getMyAppointments(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal);

    AppointmentResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentResponse cancel(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentResponse confirm(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentResponse complete(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentAvailabilityResponse getAvailability(String authorizationHeader, UUID doctorId,
                                                     LocalDate date, LocalTime startTime, LocalTime endTime);
}
