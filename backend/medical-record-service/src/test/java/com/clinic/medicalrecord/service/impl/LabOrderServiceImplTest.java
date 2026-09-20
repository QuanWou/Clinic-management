package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.client.PatientProfileResponse;
import com.clinic.medicalrecord.dto.CollectLabSampleRequest;
import com.clinic.medicalrecord.dto.CreateLabOrderRequest;
import com.clinic.medicalrecord.dto.RecordLabResultRequest;
import com.clinic.medicalrecord.entity.LabOrder;
import com.clinic.medicalrecord.entity.LabEventOutbox;
import com.clinic.medicalrecord.entity.LabOrderStatus;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.repository.LabOrderRepository;
import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class LabOrderServiceImplTest {
    private static final String AUTH = "Bearer test";

    @Mock private LabOrderRepository labOrders;
    @Mock private MedicalRecordRepository records;
    @Mock private DoctorClient doctors;
    @Mock private PatientClient patients;
    @Mock private MedicalAuditService audit;
    @Mock private LabEventOutboxRepository outbox;
    @InjectMocks private LabOrderServiceImpl service;

    private UUID doctorId;
    private UUID patientId;
    private CurrentUserPrincipal doctor;
    private CurrentUserPrincipal patient;
    private MedicalRecord record;
    private LabOrder order;

    @BeforeEach
    void setUp() {
        doctorId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.com", "Doctor", Set.of("ROLE_DOCTOR"));
        patient = new CurrentUserPrincipal(UUID.randomUUID(), "patient@test.com", "Patient", Set.of("ROLE_PATIENT"));
        record = MedicalRecord.builder().id(UUID.randomUUID()).appointmentId(UUID.randomUUID())
                .doctorId(doctorId).patientId(patientId).build();
        order = LabOrder.builder().id(UUID.randomUUID()).medicalRecord(record).testCode("CBC")
                .testName("Complete blood count").status(LabOrderStatus.ORDERED).build();
    }

    @Test
    void treatingDoctorCanCreateLabOrder() {
        when(records.findById(record.getId())).thenReturn(Optional.of(record));
        authorizeDoctor(doctorId);
        when(labOrders.save(any(LabOrder.class))).thenAnswer(invocation -> {
            LabOrder saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        var result = service.create(doctor, AUTH, record.getId(), new CreateLabOrderRequest(" CBC ", " Blood count "));

        assertEquals(LabOrderStatus.ORDERED, result.status());
        assertEquals(record.getId(), result.medicalRecordId());
        assertEquals("CBC", result.testCode());
        verify(audit).recordMutation(doctor.id(), "LAB_ORDER_CREATED", result.id());
    }

    @Test
    void unrelatedDoctorCannotCreateOrder() {
        when(records.findById(record.getId())).thenReturn(Optional.of(record));
        authorizeDoctor(UUID.randomUUID());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(doctor, AUTH, record.getId(), new CreateLabOrderRequest("CBC", "Blood count")));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(labOrders, never()).save(any());
    }

    @Test
    void adminCannotReadLabOrder() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        CurrentUserPrincipal admin = new CurrentUserPrincipal(UUID.randomUUID(), "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.get(admin, AUTH, order.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    void patientCannotReadUnreleasedResult() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.get(patient, AUTH, order.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(patients, never()).getCurrentPatientProfile(AUTH);
    }

    @Test
    void patientSeesOnlyReleasedOrdersForOwnRecord() {
        order.setStatus(LabOrderStatus.RELEASED);
        LabOrder pending = LabOrder.builder().id(UUID.randomUUID()).medicalRecord(record)
                .status(LabOrderStatus.PROCESSING).build();
        when(records.findById(record.getId())).thenReturn(Optional.of(record));
        authorizePatient(patientId);
        when(labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId())).thenReturn(List.of(pending, order));

        var result = service.list(patient, AUTH, record.getId());

        assertEquals(1, result.size());
        assertEquals(order.getId(), result.getFirst().id());
        verify(audit).recordRead(patient.id(), "LAB_ORDER_READ", order.getId());
        verify(audit, never()).recordRead(patient.id(), "LAB_ORDER_READ", pending.getId());
    }

    @Test
    void otherPatientCannotListMedicalResults() {
        when(records.findById(record.getId())).thenReturn(Optional.of(record));
        authorizePatient(UUID.randomUUID());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.list(patient, AUTH, record.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(labOrders, never()).findByMedicalRecordIdOrderByCreatedAtDesc(any());
    }

    @Test
    void cannotRecordResultBeforeProcessing() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.recordResult(doctor, AUTH, order.getId(), new RecordLabResultRequest("5", "g/L", "4-6")));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(labOrders, never()).saveAndFlush(any());
    }

    @Test
    void sampleIdentifierMustBeUnique() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);
        when(labOrders.existsBySampleIdentifier("S001")).thenReturn(true);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.collect(doctor, AUTH, order.getId(), new CollectLabSampleRequest(" S001 ")));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(labOrders, never()).saveAndFlush(any());
    }

    @Test
    void transitionsFromCollectionThroughReleaseAndPatientCanRead() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);
        when(labOrders.saveAndFlush(any(LabOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals(LabOrderStatus.COLLECTED,
                service.collect(doctor, AUTH, order.getId(), new CollectLabSampleRequest("S001")).status());
        assertEquals(LabOrderStatus.PROCESSING, service.startProcessing(doctor, AUTH, order.getId()).status());
        assertEquals(LabOrderStatus.RESULTED,
                service.recordResult(doctor, AUTH, order.getId(), new RecordLabResultRequest("5.2", "g/L", "4-6")).status());
        assertEquals(LabOrderStatus.RELEASED, service.release(doctor, AUTH, order.getId()).status());
        authorizePatient(patientId);

        var released = service.get(patient, AUTH, order.getId());

        assertEquals("5.2", released.resultValue());
        assertEquals("S001", released.sampleIdentifier());
        verify(audit).recordMutation(doctor.id(), "LAB_RESULT_RELEASED", order.getId());
        ArgumentCaptor<LabEventOutbox> event = ArgumentCaptor.forClass(LabEventOutbox.class);
        verify(outbox, times(1)).save(event.capture());
        assertEquals(LabEventOutbox.RESULT_READY, event.getValue().toEvent().eventType());
        assertEquals(order.getId(), event.getValue().toEvent().orderId());
        assertEquals(record.getAppointmentId(), event.getValue().toEvent().appointmentId());
        assertNotNull(event.getValue().toEvent().eventId());
        assertNotNull(event.getValue().toEvent().occurredAt());
        assertNull(event.getValue().getPublishedAt());
    }

    @Test
    void releasedResultCannotBeOverwritten() {
        order.setStatus(LabOrderStatus.RELEASED);
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.recordResult(doctor, AUTH, order.getId(), new RecordLabResultRequest("999", null, null)));
        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(outbox, never()).save(any());
    }

    @Test
    void optimisticLockConflictDoesNotWriteResultReadyEventOrAudit() {
        order.setStatus(LabOrderStatus.RESULTED);
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);
        when(labOrders.saveAndFlush(any(LabOrder.class)))
                .thenThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(LabOrder.class, order.getId()));

        assertThrows(org.springframework.dao.OptimisticLockingFailureException.class,
                () -> service.release(doctor, AUTH, order.getId()));
        verify(outbox, never()).save(any());
        verify(audit, never()).recordMutation(any(), any(), any());
    }

    @Test
    void unauthorizedDoctorCannotReleaseOrCreateEvent() {
        order.setStatus(LabOrderStatus.RESULTED);
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(UUID.randomUUID());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.release(doctor, AUTH, order.getId()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(outbox, never()).save(any());
    }

    @Test
    void patientCannotPerformAnyLabStateTransition() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.collect(patient, AUTH, order.getId(), new CollectLabSampleRequest("S100"))).getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.startProcessing(patient, AUTH, order.getId())).getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.recordResult(patient, AUTH, order.getId(),
                        new RecordLabResultRequest("unreleased", null, null))).getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> service.release(patient, AUTH, order.getId())).getErrorCode());
        verify(labOrders, never()).saveAndFlush(any());
        verify(outbox, never()).save(any());
    }

    @Test
    void cannotReleaseUnresultedLabOrder() {
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> service.release(doctor, AUTH, order.getId())).getErrorCode());
        verify(labOrders, never()).saveAndFlush(any());
        verify(outbox, never()).save(any());
    }

    @Test
    void failedAuditPreventsCreationOfResultReadyOutbox() {
        order.setStatus(LabOrderStatus.RESULTED);
        when(labOrders.findById(order.getId())).thenReturn(Optional.of(order));
        authorizeDoctor(doctorId);
        when(labOrders.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataIntegrityViolationException("audit unavailable"))
                .when(audit).recordMutation(doctor.id(), "LAB_RESULT_RELEASED", order.getId());

        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> service.release(doctor, AUTH, order.getId()));
        verify(outbox, never()).save(any());
    }

    @Test
    void billingContractIncludesPendingAndReleasedItemsWithoutClinicalValues() throws Exception {
        UUID appointmentId = UUID.randomUUID();
        CurrentUserPrincipal billing = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.com",
                "Reception", Set.of("ROLE_RECEPTIONIST"));
        order.setResultValue("DO NOT LEAK PHI");
        LabOrder released = LabOrder.builder().id(UUID.randomUUID()).medicalRecord(record)
                .testCode("CHEM").status(LabOrderStatus.RELEASED).releasedAt(LocalDateTime.now()).build();
        when(records.findByAppointmentId(appointmentId)).thenReturn(Optional.of(record));
        when(labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId())).thenReturn(List.of(order, released));

        var response = service.billableItems(billing, appointmentId);
        assertEquals(2, response.items().size());
        assertNull(response.items().getFirst().billableAt());
        assertNotNull(response.items().get(1).billableAt());
        String json = new com.fasterxml.jackson.databind.ObjectMapper()
                .findAndRegisterModules().writeValueAsString(response);
        assertFalse(json.contains("DO NOT LEAK PHI"));
        assertFalse(json.contains("resultValue"));
        assertFalse(json.contains("sampleIdentifier"));
        assertFalse(json.contains("patientId"));
        verify(audit, times(2)).recordRead(org.mockito.ArgumentMatchers.eq(billing.id()),
                org.mockito.ArgumentMatchers.eq("LAB_BILLING_METADATA_READ"), any());
    }

    @Test
    void billingMetadataExposesOnlyCodeAndStateIncludingPendingOrders() {
        UUID appointmentId = UUID.randomUUID();
        CurrentUserPrincipal receptionist = new CurrentUserPrincipal(UUID.randomUUID(), "reception@test.com",
                "Reception", Set.of("ROLE_RECEPTIONIST"));
        order.setResultValue("sensitive laboratory value");
        when(records.findByAppointmentId(appointmentId)).thenReturn(Optional.of(record));
        when(labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId())).thenReturn(List.of(order));

        var response = service.billableItems(receptionist, appointmentId);

        assertEquals(appointmentId, response.appointmentId());
        assertEquals(1, response.items().size());
        assertEquals("CBC", response.items().getFirst().testCode());
        assertEquals(LabOrderStatus.ORDERED, response.items().getFirst().status());
        assertEquals(null, response.items().getFirst().billableAt());
        verify(audit).recordRead(receptionist.id(), "LAB_BILLING_METADATA_READ", order.getId());
    }

    @Test
    void patientCannotRequestBillingMetadata() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.billableItems(patient, UUID.randomUUID()));
        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(records, never()).findByAppointmentId(any());
    }

    private void authorizeDoctor(UUID profileId) {
        when(doctors.getCurrentDoctorProfile(AUTH)).thenReturn(
                new DoctorProfileResponse(profileId, doctor.id(), UUID.randomUUID(), "General", null, BigDecimal.ZERO));
    }

    private void authorizePatient(UUID profileId) {
        when(patients.getCurrentPatientProfile(AUTH)).thenReturn(
                new PatientProfileResponse(profileId, patient.id(), null, null, null, null, LocalDateTime.now()));
    }
}