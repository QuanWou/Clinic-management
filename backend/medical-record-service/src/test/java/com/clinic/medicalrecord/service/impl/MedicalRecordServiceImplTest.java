package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.AppointmentResponse;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.EncounterContextResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.CreateMedicalRecordRequest;
import com.clinic.medicalrecord.dto.FinalizeMedicalRecordRequest;
import com.clinic.medicalrecord.dto.PrescriptionItemRequest;
import com.clinic.medicalrecord.dto.SaveMedicalRecordDraftRequest;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.MedicalRecordStatus;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

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

    @Mock
    private MedicalAuditService auditService;

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
        doctorPrincipal = new CurrentUserPrincipal(currentUserId, "doctor@test.com", "Doctor", Set.of("ROLE_DOCTOR"));
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
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.existsByAppointmentId(appointmentId)).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, createRequest())
        );

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
    }

    @Test
    void createShouldThrowWhenAppointmentIsNotCompleted() {
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("CONFIRMED"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, createRequest())
        );

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
    }

    @Test
    void saveDraftShouldCreateDuringInProgressWithoutDiagnosis() {
        when(appointmentClient.getEncounterContext(AUTHORIZATION, appointmentId)).thenReturn(encounter("IN_PROGRESS"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.findByAppointmentId(appointmentId)).thenReturn(Optional.empty());
        when(medicalRecordRepository.saveAndFlush(any(MedicalRecord.class))).thenAnswer(invocation -> {
            MedicalRecord record = invocation.getArgument(0);
            record.setId(UUID.randomUUID());
            record.setVersion(0L);
            record.setCreatedAt(LocalDateTime.now());
            record.setUpdatedAt(LocalDateTime.now());
            return record;
        });

        var response = medicalRecordService.saveDraft(currentUserId, AUTHORIZATION, doctorPrincipal, appointmentId,
                new SaveMedicalRecordDraftRequest("Fever", null, "Observe", null));

        assertEquals(MedicalRecordStatus.DRAFT, response.status());
        assertEquals(null, response.diagnosis());
        assertEquals(0L, response.version());
    }

    @Test
    void saveDraftShouldRejectWhenVisitIsNotInProgress() {
        when(appointmentClient.getEncounterContext(AUTHORIZATION, appointmentId)).thenReturn(encounter("CALLED"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.saveDraft(currentUserId, AUTHORIZATION, doctorPrincipal, appointmentId,
                        new SaveMedicalRecordDraftRequest("Fever", null, null, null)));

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
        verify(medicalRecordRepository, never()).saveAndFlush(any());
    }

    @Test
    void patientCannotReadDraftMedicalRecord() {
        UUID recordId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patientPrincipal = new CurrentUserPrincipal(patientUserId, "patient@test.com", "Patient", Set.of("ROLE_PATIENT"));
        MedicalRecord draft = medicalRecord();
        draft.setStatus(MedicalRecordStatus.DRAFT);
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(draft));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.getById(patientUserId, AUTHORIZATION, patientPrincipal, recordId));

        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
        verify(patientClient, never()).getCurrentPatientProfile(AUTHORIZATION);
    }

    @Test
    void finalizeDraftShouldRequireDiagnosis() {
        UUID recordId = UUID.randomUUID();
        MedicalRecord draft = medicalRecord();
        draft.setId(recordId);
        draft.setStatus(MedicalRecordStatus.DRAFT);
        draft.setDiagnosis(null);
        draft.setVersion(3L);
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(draft));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(appointmentClient.getEncounterContext(AUTHORIZATION, appointmentId)).thenReturn(encounter("IN_PROGRESS"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.finalizeRecord(currentUserId, AUTHORIZATION, doctorPrincipal, recordId,
                        new FinalizeMedicalRecordRequest(3L)));

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
        verify(medicalRecordRepository, never()).saveAndFlush(any());
    }

    @Test
    void getByIdShouldAllowPatientWhoOwnsRecord() {
        UUID medicalRecordId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patientPrincipal = new CurrentUserPrincipal(patientUserId, "patient@test.com", "Patient", Set.of("ROLE_PATIENT"));
        MedicalRecord medicalRecord = medicalRecord();

        when(medicalRecordRepository.findById(medicalRecordId)).thenReturn(Optional.of(medicalRecord));
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile(patientUserId));

        var response = medicalRecordService.getById(patientUserId, AUTHORIZATION, patientPrincipal, medicalRecordId);

        assertEquals(medicalRecord.getId(), response.id());
        assertEquals(patientId, response.patientId());
    }

    @Test
    void getByIdShouldRejectAdminWithoutClinicalRelationship() {
        UUID recordId = UUID.randomUUID();
        CurrentUserPrincipal admin = new CurrentUserPrincipal(currentUserId, "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(medicalRecord()));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.getById(currentUserId, AUTHORIZATION, admin, recordId));
        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void createShouldRejectAdminEvenWhenAppointmentExists() {
        CurrentUserPrincipal admin = new CurrentUserPrincipal(currentUserId, "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));
        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, admin, createRequest()));
        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void getByIdShouldRejectAnotherPatient() {
        UUID recordId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patient = new CurrentUserPrincipal(patientUserId, "patient@test.com", "Patient", Set.of("ROLE_PATIENT"));
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(medicalRecord()));
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(
                new PatientProfileResponse(UUID.randomUUID(), patientUserId, null, null, null, null, LocalDateTime.now()));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.getById(patientUserId, AUTHORIZATION, patient, recordId));
        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void createShouldHideDuplicateRecordFromUnrelatedDoctor() {
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(UUID.randomUUID()));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.create(currentUserId, AUTHORIZATION, doctorPrincipal, createRequest()));
        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
        org.mockito.Mockito.verify(medicalRecordRepository, org.mockito.Mockito.never()).existsByAppointmentId(appointmentId);
    }

    @Test
    void patientHistoryRejectsUnrelatedDoctor() {
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctorId))
                .thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> medicalRecordService.getByPatientId(currentUserId, AUTHORIZATION, doctorPrincipal, patientId));
        assertEquals(ErrorCode.FORBIDDEN, exception.getErrorCode());
    }

    @Test
    void receptionistCannotReadMedicalRecordOrPatientHistory() {
        UUID recordId = UUID.randomUUID();
        CurrentUserPrincipal receptionist = new CurrentUserPrincipal(currentUserId, "frontdesk@test.com",
                "Front desk", Set.of("ROLE_RECEPTIONIST"));
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(medicalRecord()));

        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getById(currentUserId, AUTHORIZATION, receptionist, recordId)).getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getByPatientId(currentUserId, AUTHORIZATION, receptionist, patientId)).getErrorCode());
        verify(auditService, never()).recordRead(any(), any(), any());
    }

    @Test
    void doctorCannotReadAnotherDoctorsMedicalRecord() {
        UUID recordId = UUID.randomUUID();
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(medicalRecord()));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(UUID.randomUUID()));

        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getById(currentUserId, AUTHORIZATION, doctorPrincipal, recordId)).getErrorCode());
        verify(auditService, never()).recordRead(any(), any(), any());
    }

    @Test
    void missingAuditWriteBlocksClinicalRecordRead() {
        UUID recordId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patient = new CurrentUserPrincipal(patientUserId, "patient@test.com",
                "Patient", Set.of("ROLE_PATIENT"));
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(medicalRecord()));
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile(patientUserId));
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataIntegrityViolationException("audit unavailable"))
                .when(auditService).recordRead(patientUserId, "MEDICAL_RECORD_READ", recordId);

        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> medicalRecordService.getById(patientUserId, AUTHORIZATION, patient, recordId));
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

    private EncounterContextResponse encounter(String queueStatus) {
        return new EncounterContextResponse(
                UUID.randomUUID(), appointmentId, patientId, doctorId, 7, queueStatus,
                LocalDate.now(), LocalTime.of(9, 0), LocalTime.of(10, 0), "Checkup",
                new EncounterContextResponse.PatientSummary(patientId, "Patient Test", null, null, null)
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
