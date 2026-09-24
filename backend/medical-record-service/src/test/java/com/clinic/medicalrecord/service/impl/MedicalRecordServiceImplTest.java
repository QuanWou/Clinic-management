package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.EncounterContextResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.FinalizeMedicalRecordRequest;
import com.clinic.medicalrecord.dto.SaveMedicalRecordDraftRequest;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.entity.MedicalRecordStatus;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.repository.MedicalRecordDisplayLookup;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

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
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class MedicalRecordServiceImplTest {

    private static final String AUTHORIZATION = "Bearer token";

    @Mock
    private MedicalRecordRepository medicalRecordRepository;

    @Mock
    private MedicalRecordDisplayLookup displayLookup;

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
    void patientHistoryRejectsUnrelatedDoctor() {
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(patientId, doctorId, MedicalRecordStatus.FINAL))
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
    void doctorDirectoryIsBoundedAndUsesOnlyAuthenticatedDoctorId() {
        MedicalRecord owned = medicalRecord();
        var pageable = PageRequest.of(0, 8, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.findByDoctorIdAndStatus(doctorId, MedicalRecordStatus.FINAL, pageable))
                .thenReturn(new PageImpl<>(List.of(owned), pageable, 96));
        when(displayLookup.forDoctor(doctorId, List.of(owned.getId()))).thenReturn(java.util.Map.of(owned.getId(),
                new MedicalRecordDisplayLookup.Display("BN000005", "Demo Patient", "BS000001", "Demo Doctor",
                        LocalDate.of(2026, 9, 18), LocalTime.of(10, 0), LocalTime.of(11, 0))));

        var result = medicalRecordService.getMyDoctorRecords(currentUserId, AUTHORIZATION, doctorPrincipal, 0, 8);

        assertEquals(96, result.getTotalElements());
        assertEquals(12, result.getTotalPages());
        assertEquals(doctorId, result.getContent().getFirst().doctorId());
        assertEquals("BN000005", result.getContent().getFirst().patientCode());
        assertEquals("BS000001", result.getContent().getFirst().doctorCode());
        assertEquals(LocalDate.of(2026, 9, 18), result.getContent().getFirst().appointmentDate());
        verify(medicalRecordRepository).findByDoctorIdAndStatus(doctorId, MedicalRecordStatus.FINAL, pageable);
        verify(auditService).recordRead(currentUserId, "MEDICAL_RECORD_READ", owned.getId());
    }

    @Test
    void doctorCanSearchByVisiblePatientCodeOnlyWithinOwnRecords() {
        MedicalRecord owned = medicalRecord();
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(displayLookup.patientIdForDoctorCode(doctorId, "BN000005")).thenReturn(patientId);
        when(medicalRecordRepository.findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(patientId, doctorId, MedicalRecordStatus.FINAL))
                .thenReturn(List.of(owned));
        when(displayLookup.forDoctor(doctorId, List.of(owned.getId()))).thenReturn(java.util.Map.of(owned.getId(),
                new MedicalRecordDisplayLookup.Display("BN000005", "Demo Patient", "BS000001", "Demo Doctor",
                        LocalDate.of(2026, 9, 18), LocalTime.of(10, 0), LocalTime.of(11, 0))));

        var result = medicalRecordService.getByPatientCode(currentUserId, AUTHORIZATION, doctorPrincipal, "BN000005");
        assertEquals(1, result.size());
        assertEquals("BN000005", result.getFirst().patientCode());
        verify(auditService).recordRead(currentUserId, "MEDICAL_RECORD_READ", owned.getId());
    }

    @Test
    void doctorCodeLookupRejectsOtherRoleAndUnrelatedPatients() {
        var admin = new CurrentUserPrincipal(currentUserId, "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getByPatientCode(currentUserId, AUTHORIZATION, admin, "BN000005")).getErrorCode());
        assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                () -> medicalRecordService.getByPatientCode(currentUserId, AUTHORIZATION, doctorPrincipal, "../../etc")).getErrorCode());
        verifyNoInteractions(displayLookup, doctorClient, medicalRecordRepository);

        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getByPatientCode(currentUserId, AUTHORIZATION, doctorPrincipal, "BN000005")).getErrorCode());
        verify(medicalRecordRepository, never()).findByPatientIdAndDoctorIdAndStatusOrderByCreatedAtDesc(any(), any(), any());
    }

    @Test
    void doctorDirectoryRejectsUnrelatedRolesBeforeDoctorLookup() {
        var admin = new CurrentUserPrincipal(currentUserId, "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> medicalRecordService.getMyDoctorRecords(currentUserId, AUTHORIZATION, admin, 0, 8)).getErrorCode());
        verifyNoInteractions(doctorClient, medicalRecordRepository, auditService);
    }

    @Test
    void doctorDirectoryRejectsOversizedOrNegativePaginationBeforeDoctorLookup() {
        for (int[] requested : new int[][] {{-1, 8}, {0, 0}, {0, 21}, {100001, 8}}) {
            assertEquals(ErrorCode.VALIDATION_ERROR, assertThrows(BusinessException.class,
                    () -> medicalRecordService.getMyDoctorRecords(currentUserId, AUTHORIZATION,
                            doctorPrincipal, requested[0], requested[1])).getErrorCode());
        }
        verifyNoInteractions(doctorClient, medicalRecordRepository, auditService);
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
