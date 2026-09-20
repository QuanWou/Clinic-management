package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.PatientProfileResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.ReceptionVisitRepository;
import com.clinic.appointment.service.ReceptionQueueService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.appointment.security.CurrentUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceImplTest {

    private static final String AUTHORIZATION = "Bearer token";

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private PatientClient patientClient;

    @Mock
    private DoctorClient doctorClient;

    @Mock
    private ReceptionVisitRepository receptionVisitRepository;

    @Mock
    private ReceptionQueueService receptionQueueService;

    @InjectMocks
    private AppointmentServiceImpl appointmentService;

    private UUID currentUserId;
    private UUID patientId;
    private UUID doctorId;

    @BeforeEach
    void setUp() {
        currentUserId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
    }

    @Test
    void createShouldSavePendingAppointmentWhenSlotIsAvailable() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                doctorId,
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "General consultation"
        );

        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile());
        when(doctorClient.getAvailability(
                eq(AUTHORIZATION),
                eq(doctorId),
                eq(request.appointmentDate().getDayOfWeek().getValue()),
                eq(request.startTime()),
                eq(request.endTime())
        )).thenReturn(new DoctorAvailabilityResponse(doctorId, true, request.appointmentDate().getDayOfWeek().getValue(), request.startTime(), request.endTime()));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                eq(doctorId),
                eq(request.appointmentDate()),
                eq(request.endTime()),
                eq(request.startTime()),
                eq(AppointmentStatus.CANCELLED)
        )).thenReturn(false);
        when(appointmentRepository.saveAndFlush(any(Appointment.class))).thenAnswer(invocation -> {
            Appointment appointment = invocation.getArgument(0);
            appointment.setId(UUID.randomUUID());
            appointment.setCreatedAt(LocalDateTime.now());
            appointment.setUpdatedAt(LocalDateTime.now());
            return appointment;
        });

        var response = appointmentService.create(currentUserId, AUTHORIZATION, patientPrincipal(), request);

        assertEquals(patientId, response.patientId());
        assertEquals(doctorId, response.doctorId());
        assertEquals(AppointmentStatus.PENDING, response.status());
    }

    @Test
    void createShouldThrowWhenTimeRangeIsInvalid() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                doctorId,
                LocalDate.now().plusDays(1),
                LocalTime.of(10, 0),
                LocalTime.of(9, 0),
                "General consultation"
        );

        BusinessException exception = assertThrows(BusinessException.class,
                () -> appointmentService.create(currentUserId, AUTHORIZATION, patientPrincipal(), request));

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
        verify(patientClient, never()).getCurrentPatientProfile(any());
    }

    @Test
    void createShouldThrowWhenDoctorHasOverlap() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                doctorId,
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "General consultation"
        );

        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile());
        when(doctorClient.getAvailability(
                eq(AUTHORIZATION),
                eq(doctorId),
                eq(request.appointmentDate().getDayOfWeek().getValue()),
                eq(request.startTime()),
                eq(request.endTime())
        )).thenReturn(new DoctorAvailabilityResponse(doctorId, true, request.appointmentDate().getDayOfWeek().getValue(), request.startTime(), request.endTime()));
        when(appointmentRepository.existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThanAndStatusNot(
                eq(doctorId),
                eq(request.appointmentDate()),
                eq(request.endTime()),
                eq(request.startTime()),
                eq(AppointmentStatus.CANCELLED)
        )).thenReturn(true);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> appointmentService.create(currentUserId, AUTHORIZATION, patientPrincipal(), request));

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
    }

    @Test
    void createShouldThrowWhenDoctorNotAvailableInSchedule() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                doctorId,
                LocalDate.now().plusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "General consultation"
        );

        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile());
        when(doctorClient.getAvailability(
                eq(AUTHORIZATION),
                eq(doctorId),
                eq(request.appointmentDate().getDayOfWeek().getValue()),
                eq(request.startTime()),
                eq(request.endTime())
        )).thenReturn(new DoctorAvailabilityResponse(doctorId, false, request.appointmentDate().getDayOfWeek().getValue(), request.startTime(), request.endTime()));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> appointmentService.create(currentUserId, AUTHORIZATION, patientPrincipal(), request));

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
        assertEquals("Doctor is not available at the requested time slot based on schedule", exception.getMessage());
    }

    @Test
    void getMyAppointmentsShouldResolvePatientProfileId() {
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile());
        when(appointmentRepository.findByPatientIdOrderByAppointmentDateDescStartTimeDesc(patientId))
                .thenReturn(List.of(appointment()));

        var responses = appointmentService.getMyAppointments(currentUserId, AUTHORIZATION, patientPrincipal());

        assertEquals(1, responses.size());
        assertEquals(patientId, responses.getFirst().patientId());
    }

    @Test
    void cancelShouldThrowWhenAppointmentBelongsToAnotherPatient() {
        UUID appointmentId = UUID.randomUUID();
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile());
        when(appointmentRepository.findByIdForUpdate(appointmentId)).thenReturn(Optional.of(
                appointmentBuilder().patientId(UUID.randomUUID()).status(AppointmentStatus.PENDING).build()
        ));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> appointmentService.cancel(currentUserId, AUTHORIZATION, patientPrincipal(), appointmentId));

        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
    }

    private PatientProfileResponse patientProfile() {
        return new PatientProfileResponse(
                patientId,
                currentUserId,
                null,
                null,
                null,
                null,
                LocalDateTime.now()
        );
    }

    private CurrentUserPrincipal patientPrincipal() {
        return new CurrentUserPrincipal(currentUserId, "patient@example.test", "Patient", java.util.Set.of("ROLE_PATIENT"));
    }

    private Appointment appointment() {
        return appointmentBuilder().patientId(patientId).status(AppointmentStatus.PENDING).build();
    }

    private Appointment.AppointmentBuilder appointmentBuilder() {
        return Appointment.builder()
                .id(UUID.randomUUID())
                .patientId(patientId)
                .doctorId(doctorId)
                .appointmentDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .status(AppointmentStatus.PENDING)
                .reason("General consultation")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now());
    }
}
