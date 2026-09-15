package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.AppointmentResponse;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.CreateMedicalRecordRequest;
import com.clinic.medicalrecord.dto.PrescriptionItemRequest;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MedicalRecordServiceImplTest {

    private static final String AUTHORIZATION = "Bearer token";

    @Mock
    private MedicalRecordRepository medicalRecordRepository;

    @Mock
    private AppointmentClient appointmentClient;

    @Mock
    private DoctorClient doctorClient;

    @Mock
    private PatientClient patientClient;

    @InjectMocks
    private MedicalRecordServiceImpl medicalRecordService;

    private UUID currentUserId;
    private UUID appointmentId;
    private UUID patientId;
    private UUID doctorId;
    private CurrentUserPrincipal doctorPrincipal;

    @BeforeEach
    void setUp() {
        currentUserId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        doctorPrincipal = new CurrentUserPrincipal(currentUserId, "doctor@test.com", "Doctor", Set.of("DOCTOR"));
    }

    @Test
    void createShouldSaveMedicalRecordWhenAppointmentIsCompletedAndDoctorMatches() {
        CreateMedicalRecordRequest request = createRequest();

        when(medicalRecordRepository.existsByAppointmentId(appointmentId)).thenReturn(false);
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.save(any(MedicalRecord.class))).thenAnswer(invocation -> {
            MedicalRecord medicalRecord = invocation.getArgument(0);
            medicalRecord.setId(UUID.randomUUID());
            medicalRecord.setCreatedAt(LocalDateTime.now());
            medicalRecord.setUpdatedAt(LocalDateTime.now());
            medicalRecord.getPrescriptions().forEach(prescription -> {
                prescription.setId(UUID.randomUUID());
                prescription.setCreatedAt(LocalDateTime.now());
                prescription.getItems().forEach(item -> item.setId(UUID.randomUUID()));
            });
            return medicalRecord;
        });

        var response = medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, request);

        assertEquals(appointmentId, response.appointmentId());
        assertEquals(patientId, response.patientId());
        assertEquals(doctorId, response.doctorId());
        assertEquals(1, response.prescriptions().size());
        assertEquals("Amoxicillin", response.prescriptions().getFirst().items().getFirst().medicineName());
    }

    @Test
    void createShouldThrowWhenMedicalRecordAlreadyExistsForAppointment() {
        when(medicalRecordRepository.existsByAppointmentId(appointmentId)).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, createRequest())
        );

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
    }

    @Test
    void createShouldThrowWhenAppointmentIsNotCompleted() {
        when(medicalRecordRepository.existsByAppointmentId(appointmentId)).thenReturn(false);
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("CONFIRMED"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, createRequest())
        );

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
    }

    @Test
    void getByIdShouldAllowPatientWhoOwnsRecord() {
        UUID medicalRecordId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patientPrincipal = new CurrentUserPrincipal(patientUserId, "patient@test.com", "Patient", Set.of("PATIENT"));
        MedicalRecord medicalRecord = medicalRecord();

        when(medicalRecordRepository.findById(medicalRecordId)).thenReturn(Optional.of(medicalRecord));
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile(patientUserId));

        var response = medicalRecordService.getById(patientUserId, AUTHORIZATION, patientPrincipal, medicalRecordId);

        assertEquals(medicalRecord.getId(), response.id());
        assertEquals(patientId, response.patientId());
    }

    private CreateMedicalRecordRequest createRequest() {
        return new CreateMedicalRecordRequest(
                appointmentId,
                "Fever and cough",
                "Upper respiratory infection",
                "Follow up if symptoms persist",
                List.of(new PrescriptionItemRequest(
                        "Amoxicillin",
                        "500mg",
                        "3 times per day",
                        "7 days",
                        "After meals"
                ))
        );
    }

    private AppointmentResponse appointment(String status) {
        return new AppointmentResponse(
                appointmentId,
                patientId,
                doctorId,
                LocalDate.now().minusDays(1),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                status,
                "Checkup",
                LocalDateTime.now().minusDays(1),
                LocalDateTime.now().minusDays(1)
        );
    }

    private DoctorProfileResponse doctorProfile(UUID profileDoctorId) {
        return new DoctorProfileResponse(
                profileDoctorId,
                currentUserId,
                UUID.randomUUID(),
                "General",
                "Doctor bio",
                BigDecimal.ZERO
        );
    }

    private PatientProfileResponse patientProfile(UUID userId) {
        return new PatientProfileResponse(
                patientId,
                userId,
                null,
                null,
                null,
                null,
                LocalDateTime.now()
        );
    }

    private MedicalRecord medicalRecord() {
        return MedicalRecord.builder()
                .id(UUID.randomUUID())
                .appointmentId(appointmentId)
                .patientId(patientId)
                .doctorId(doctorId)
                .symptoms("Fever")
                .diagnosis("Upper respiratory infection")
                .notes("Rest")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
