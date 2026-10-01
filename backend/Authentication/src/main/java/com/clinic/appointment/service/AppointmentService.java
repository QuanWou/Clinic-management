package com.clinic.appointment.service;

import com.clinic.appointment.dto.AppointmentResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.security.CurrentUserPrincipal;

import java.util.List;
import java.util.UUID;

public interface AppointmentService {

    AppointmentResponse create(UUID currentUserId, String authorizationHeader, CreateAppointmentRequest request);

    List<AppointmentResponse> getMyAppointments(UUID currentUserId, String authorizationHeader);

    AppointmentResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentResponse cancel(UUID currentUserId, String authorizationHeader, UUID appointmentId);

    AppointmentResponse confirm(UUID currentUserId, CurrentUserPrincipal principal, UUID appointmentId);

    AppointmentResponse complete(UUID currentUserId, CurrentUserPrincipal principal, UUID appointmentId);
}
