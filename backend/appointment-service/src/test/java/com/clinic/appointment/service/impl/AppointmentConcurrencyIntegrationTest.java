package com.clinic.appointment.service.impl;

import com.clinic.appointment.client.DoctorAvailabilityResponse;
import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.PatientClient;
import com.clinic.appointment.client.PatientProfileResponse;
import com.clinic.appointment.dto.CreateAppointmentRequest;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Runs only on an explicitly provisioned, isolated clinic_security_test PostgreSQL database.
 * Example (Windows cmd): set CLINIC_SECURITY_TEST_DB=true && mvn -pl appointment-service -am test
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/clinic_security_test?currentSchema=appointment",
        "spring.datasource.username=postgres",
        "spring.datasource.password=password",
        "spring.jpa.properties.hibernate.default_schema=appointment",
        "spring.flyway.schemas=appointment"
})
@EnabledIfEnvironmentVariable(named = "CLINIC_SECURITY_TEST_DB", matches = "true")
class AppointmentConcurrencyIntegrationTest {
    private static final String BEARER = "Bearer test-token";

    @Autowired AppointmentServiceImpl service;
    @Autowired AppointmentRepository appointments;
    @MockBean PatientClient patients;
    @MockBean DoctorClient doctors;

    // Never delete all appointments, even in the isolated database. Every test uses
    // a random doctor ID; test data is retained for explicit, scoped cleanup later.

    private CurrentUserPrincipal patient(UUID userId) {
        return new CurrentUserPrincipal(userId, "patient@example.test", "Patient", Set.of("ROLE_PATIENT"));
    }

    private void prepareClients(UUID userId, UUID patientId) {
        when(patients.getCurrentPatientProfile(BEARER))
                .thenReturn(new PatientProfileResponse(patientId, userId, null, null, null, null, null));
        when(doctors.getAvailability(anyString(), any(UUID.class), anyInt(), any(LocalTime.class), any(LocalTime.class)))
                .thenAnswer(call -> new DoctorAvailabilityResponse(
                        call.getArgument(1), true, call.getArgument(2), call.getArgument(3), call.getArgument(4)));
    }

    @Test
    void twoSimultaneousBookingsForOverlappingRangesAllowExactlyOne() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        prepareClients(userId, UUID.randomUUID());
        LocalDate date = LocalDate.now().plusDays(4);
        CreateAppointmentRequest first = new CreateAppointmentRequest(doctorId, date,
                LocalTime.of(9, 0), LocalTime.of(10, 0), "First");
        CreateAppointmentRequest second = new CreateAppointmentRequest(doctorId, date,
                LocalTime.of(9, 30), LocalTime.of(10, 30), "Second");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService workers = Executors.newFixedThreadPool(2)) {
            Future<String> one = workers.submit(() -> bookTogether(userId, first, ready, start));
            Future<String> two = workers.submit(() -> bookTogether(userId, second, ready, start));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            String resultOne = one.get(30, TimeUnit.SECONDS);
            String resultTwo = two.get(30, TimeUnit.SECONDS);
            assertEquals(Set.of("SAVED", "CONFLICT"), Set.of(resultOne, resultTwo));
            assertEquals(1, appointments.findByDoctorIdAndAppointmentDateOrderByStartTimeAsc(doctorId, date).size());
        }
    }

    @Test
    void cancelledBookingReleasesItsSlot() {
        UUID userId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        prepareClients(userId, UUID.randomUUID());
        var request = new CreateAppointmentRequest(doctorId, LocalDate.now().plusDays(4),
                LocalTime.of(11, 0), LocalTime.of(12, 0), "Checkup");

        var booked = service.create(userId, BEARER, patient(userId), request);
        assertEquals(AppointmentStatus.CANCELLED,
                service.cancel(userId, BEARER, patient(userId), booked.id()).status());
        assertEquals(AppointmentStatus.PENDING,
                service.create(userId, BEARER, patient(userId), request).status());
    }

    @Test
    void adjacentBookingsForSameDoctorDoNotOverlap() {
        UUID userId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        prepareClients(userId, UUID.randomUUID());
        LocalDate date = LocalDate.now().plusDays(4);
        var first = new CreateAppointmentRequest(doctorId, date,
                LocalTime.of(9, 0), LocalTime.of(10, 0), "Morning checkup");
        var adjacent = new CreateAppointmentRequest(doctorId, date,
                LocalTime.of(10, 0), LocalTime.of(11, 0), "Next checkup");

        assertEquals(AppointmentStatus.PENDING, service.create(userId, BEARER, patient(userId), first).status());
        assertEquals(AppointmentStatus.PENDING, service.create(userId, BEARER, patient(userId), adjacent).status());
        assertEquals(2, appointments.findByDoctorIdAndAppointmentDateOrderByStartTimeAsc(doctorId, date).size());
    }

    private String bookTogether(UUID userId, CreateAppointmentRequest request,
                                CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent booking start timed out");
        }
        try {
            service.create(userId, BEARER, patient(userId), request);
            return "SAVED";
        } catch (BusinessException ex) {
            if (ErrorCode.CONFLICT.equals(ex.getErrorCode())) {
                return "CONFLICT";
            }
            throw ex;
        }
    }
}
