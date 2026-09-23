package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.AppointmentClient;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.DoctorProfileResponse;
import com.clinic.medicalrecord.client.EncounterContextResponse;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.dto.SaveMedicalRecordDraftRequest;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * PostgreSQL-only concurrency checks for the clinical draft lifecycle.
 * Runs only against the explicitly provisioned clinic_security_test database.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/clinic_security_test?currentSchema=medical_record",
        "spring.datasource.username=postgres",
        "spring.datasource.password=password",
        "spring.jpa.properties.hibernate.default_schema=medical_record",
        "spring.flyway.schemas=medical_record"
})
@EnabledIfEnvironmentVariable(named = "CLINIC_SECURITY_TEST_DB", matches = "true")
class MedicalRecordDraftConcurrencyIntegrationTest {
    private static final String AUTHORIZATION = "Bearer test-token";

    @Autowired MedicalRecordServiceImpl service;
    @Autowired MedicalRecordRepository records;
    @MockBean AppointmentClient appointments;
    @MockBean DoctorClient doctors;
    @MockBean PatientClient patients;
    @MockBean MedicalAuditService audits;

    @Test
    void simultaneousInitialDraftWritesAllowExactlyOneCreate() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        prepareEncounter(userId, doctorId, patientId, appointmentId);
        CurrentUserPrincipal principal = doctor(userId);
        SaveMedicalRecordDraftRequest first = new SaveMedicalRecordDraftRequest("Fever", null, "First tab", null);
        SaveMedicalRecordDraftRequest second = new SaveMedicalRecordDraftRequest("Fever", null, "Second tab", null);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService workers = Executors.newFixedThreadPool(2)) {
            Future<String> one = workers.submit(() -> saveTogether(userId, principal, appointmentId, first, ready, start));
            Future<String> two = workers.submit(() -> saveTogether(userId, principal, appointmentId, second, ready, start));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(Set.of("SAVED", "CONFLICT"), Set.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)));
        }

        assertTrue(records.findByAppointmentId(appointmentId).isPresent());
    }

    @Test
    void simultaneousUpdatesUsingSameVersionAllowExactlyOneWrite() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        prepareEncounter(userId, doctorId, patientId, appointmentId);
        CurrentUserPrincipal principal = doctor(userId);
        var created = service.saveDraft(userId, AUTHORIZATION, principal, appointmentId,
                new SaveMedicalRecordDraftRequest("Initial", null, null, null));
        SaveMedicalRecordDraftRequest first = new SaveMedicalRecordDraftRequest("Updated A", null, "A", created.version());
        SaveMedicalRecordDraftRequest second = new SaveMedicalRecordDraftRequest("Updated B", null, "B", created.version());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService workers = Executors.newFixedThreadPool(2)) {
            Future<String> one = workers.submit(() -> saveTogether(userId, principal, appointmentId, first, ready, start));
            Future<String> two = workers.submit(() -> saveTogether(userId, principal, appointmentId, second, ready, start));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(Set.of("SAVED", "CONFLICT"), Set.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS)));
        }
    }

    private void prepareEncounter(UUID userId, UUID doctorId, UUID patientId, UUID appointmentId) {
        when(doctors.getCurrentDoctorProfile(AUTHORIZATION)).thenReturn(
                new DoctorProfileResponse(doctorId, userId, null, null, null, BigDecimal.ZERO));
        when(appointments.getEncounterContext(AUTHORIZATION, appointmentId)).thenReturn(
                new EncounterContextResponse(UUID.randomUUID(), appointmentId, patientId, doctorId, 1,
                        "IN_PROGRESS", LocalDate.now(), LocalTime.of(9, 0), LocalTime.of(9, 30), "Checkup",
                        new EncounterContextResponse.PatientSummary(patientId, "Concurrency Patient", null, null, null)));
    }

    private CurrentUserPrincipal doctor(UUID userId) {
        return new CurrentUserPrincipal(userId, "doctor@example.test", "Doctor", Set.of("ROLE_DOCTOR"));
    }

    private String saveTogether(UUID userId, CurrentUserPrincipal principal, UUID appointmentId,
                                SaveMedicalRecordDraftRequest request, CountDownLatch ready,
                                CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent draft start timed out");
        }
        try {
            service.saveDraft(userId, AUTHORIZATION, principal, appointmentId, request);
            return "SAVED";
        } catch (BusinessException ex) {
            if (ErrorCode.CONFLICT.equals(ex.getErrorCode())) {
                return "CONFLICT";
            }
            throw ex;
        }
    }
}