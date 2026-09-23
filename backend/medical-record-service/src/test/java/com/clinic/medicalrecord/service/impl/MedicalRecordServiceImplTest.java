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
    void doctorDirectoryIsBoundedAndUsesOnlyAuthenticatedDoctorId() {
        MedicalRecord owned = medicalRecord();
        var pageable = PageRequest.of(0, 8, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(medicalRecordRepository.findByDoctorId(doctorId, pageable))
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
        verify(medicalRecordRepository).findByDoctorId(doctorId, pageable);
        verify(auditService).recordRead(currentUserId, "MEDICAL_RECORD_READ", owned.getId());
    }

    @Test
    void doctorCanSearchByVisiblePatientCodeOnlyWithinOwnRecords() {
        MedicalRecord owned = medicalRecord();
        when(doctorClient.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(doctorProfile(doctorId));
        when(displayLookup.patientIdForDoctorCode(doctorId, "BN000005")).thenReturn(patientId);
        when(medicalRecordRepository.findByPatientIdAndDoctorIdOrderByCreatedAtDesc(patientId, doctorId))
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
        verify(medicalRecordRepository, never()).findByPatientIdAndDoctorIdOrderByCreatedAtDesc(any(), any());
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
