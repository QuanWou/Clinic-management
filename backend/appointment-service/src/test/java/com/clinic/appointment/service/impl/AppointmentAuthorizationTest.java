package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.DoctorProfileResponse;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.PatientProfileResponse;
import com.clinic.appointment.client.RecipientDirectoryClient;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.AppointmentNotificationOutboxRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentAuthorizationTest {
    private static final String BEARER = "Bearer access-token";

    @Mock AppointmentRepository appointments;
    @Mock PatientClient patients;
    @Mock DoctorClient doctors;
    @Mock ReceptionVisitRepository visits;
    @Mock ReceptionQueueService receptionQueue;
    @Mock AppointmentNotificationOutboxRepository notificationOutbox;
    @Mock RecipientDirectoryClient recipients;
    @InjectMocks AppointmentServiceImpl service;

    private UUID userId;
    private UUID doctorId;
    private UUID patientId;
    private Appointment appointment;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        appointment = Appointment.builder()
                .id(UUID.randomUUID()).doctorId(doctorId).patientId(patientId).patientUserId(userId)
                .appointmentDate(LocalDate.now().plusDays(3))
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0))
                .status(AppointmentStatus.PENDING).build();
    }

    private CurrentUserPrincipal principal(String role) {
        return new CurrentUserPrincipal(userId, "user@example.test", "Test User", Set.of("ROLE_" + role));
    }

    private void loadForRead() {
        when(appointments.findById(appointment.getId())).thenReturn(Optional.of(appointment));
    }

    private void loadForMutation() {
        when(appointments.findByIdForUpdate(appointment.getId())).thenReturn(Optional.of(appointment));
    }

    private PatientProfileResponse patient(UUID profileId) {
        return new PatientProfileResponse(profileId, userId, null, null, null, null, null);
    }

    @Test
    void differentPatientCannotViewAppointment() {
        loadForRead();
        when(patients.getCurrentPatientProfile(BEARER)).thenReturn(patient(UUID.randomUUID()));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getById(userId, BEARER, principal("PATIENT"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void patientCanViewOwnAppointment() {
        loadForRead();
        when(patients.getCurrentPatientProfile(BEARER)).thenReturn(patient(patientId));
        assertEquals(appointment.getId(), service.getById(userId, BEARER, principal("PATIENT"), appointment.getId()).id());
    }

    @Test
    void patientWithDoctorRoleCanStillViewTheirOwnPatientAppointment() {
        loadForRead();
        when(patients.getCurrentPatientProfile(BEARER)).thenReturn(patient(patientId));
        CurrentUserPrincipal both = new CurrentUserPrincipal(userId, "both@example.test", "Both",
                Set.of("ROLE_PATIENT", "ROLE_DOCTOR"));
        assertEquals(appointment.getId(), service.getById(userId, BEARER, both, appointment.getId()).id());
        verifyNoInteractions(doctors);
    }

    @Test
    void adminCanReadWithoutOwningTheAppointment() {
        loadForRead();
        assertEquals(appointment.getId(), service.getById(userId, BEARER, principal("ADMIN"), appointment.getId()).id());
        verifyNoInteractions(patients, doctors);
    }

    @Test
    void differentDoctorCannotViewAppointment() {
        loadForRead();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(UUID.randomUUID(), userId));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getById(userId, BEARER, principal("DOCTOR"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void doctorProfileMustMatchAuthenticatedUserNotJustDoctorId() {
        loadForRead();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(doctorId, UUID.randomUUID()));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getById(userId, BEARER, principal("DOCTOR"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void assignedDoctorCanViewAppointment() {
        loadForRead();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(doctorId, userId));
        assertEquals(appointment.getId(), service.getById(userId, BEARER, principal("DOCTOR"), appointment.getId()).id());
    }

    @Test
    void receptionistCanViewAppointmentWithoutDoctorProfile() {
        loadForRead();
        assertEquals(appointment.getId(), service.getById(userId, BEARER, principal("RECEPTIONIST"), appointment.getId()).id());
        verifyNoInteractions(doctors, patients);
    }

    @Test
    void unrelatedDoctorCannotConfirm() {
        loadForMutation();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(UUID.randomUUID(), userId));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.confirm(userId, BEARER, principal("DOCTOR"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(appointments, never()).save(any());
    }

    @Test
    void assignedDoctorCanConfirm() {
        loadForMutation();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(doctorId, userId));
        when(appointments.save(appointment)).thenReturn(appointment);
        assertEquals(AppointmentStatus.CONFIRMED,
                service.confirm(userId, BEARER, principal("DOCTOR"), appointment.getId()).status());
    }

    @Test
    void receptionistCanConfirmButCannotComplete() {
        loadForMutation();
        when(appointments.save(appointment)).thenReturn(appointment);
        assertEquals(AppointmentStatus.CONFIRMED,
                service.confirm(userId, BEARER, principal("RECEPTIONIST"), appointment.getId()).status());
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.complete(userId, BEARER, principal("RECEPTIONIST"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void unrelatedDoctorCannotComplete() {
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        loadForMutation();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(UUID.randomUUID(), userId));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.complete(userId, BEARER, principal("DOCTOR"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(appointments, never()).save(any());
    }

    @Test
    void assignedDoctorCanCompleteConfirmedAppointment() {
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        loadForMutation();
        when(doctors.getCurrentDoctorProfile(BEARER)).thenReturn(new DoctorProfileResponse(doctorId, userId));
        when(appointments.save(appointment)).thenReturn(appointment);
        assertEquals(AppointmentStatus.COMPLETED,
                service.complete(userId, BEARER, principal("DOCTOR"), appointment.getId()).status());
    }

    @Test
    void doctorCannotCancelPatientAppointment() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.cancel(userId, BEARER, principal("DOCTOR"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verifyNoInteractions(patients, doctors, appointments);
    }

    @Test
    void patientCannotCancelAnotherPatientsAppointment() {
        loadForMutation();
        when(patients.getCurrentPatientProfile(BEARER)).thenReturn(patient(UUID.randomUUID()));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.cancel(userId, BEARER, principal("PATIENT"), appointment.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(appointments, never()).save(any());
    }

    @Test
    void adminCanCompleteConfirmedAppointmentWithoutDoctorProfile() {
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        loadForMutation();
        when(appointments.save(appointment)).thenReturn(appointment);
        assertEquals(AppointmentStatus.COMPLETED,
                service.complete(userId, BEARER, principal("ADMIN"), appointment.getId()).status());
        verifyNoInteractions(patients, doctors);
    }

    @Test
    void receptionistCanCancelWithoutPatientProfile() {
        loadForMutation();
        when(appointments.save(appointment)).thenReturn(appointment);
        assertEquals(AppointmentStatus.CANCELLED,
                service.cancel(userId, BEARER, principal("RECEPTIONIST"), appointment.getId()).status());
        verifyNoInteractions(patients);
    }

    @Test
    void cancelledAppointmentCannotBeConfirmed() {
        appointment.setStatus(AppointmentStatus.CANCELLED);
        loadForMutation();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.confirm(userId, BEARER, principal("ADMIN"), appointment.getId()));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
    }

    @Test
    void doctorCannotCreateAppointmentUsingOtherPatientsProfile() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(doctorId, LocalDate.now().plusDays(1),
                LocalTime.of(9, 0), LocalTime.of(10, 0), "Checkup");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(userId, BEARER, principal("DOCTOR"), request));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verifyNoInteractions(patients, doctors, appointments);
    }
}
