package com.clinic.appointment.service;

import com.clinic.appointment.client.DoctorClient;
import com.clinic.appointment.client.DoctorProfileResponse;
import com.clinic.appointment.dto.AddPerformedServiceRequest;
import com.clinic.appointment.entity.Appointment;
import com.clinic.appointment.entity.AppointmentBillingClosure;
import com.clinic.appointment.entity.AppointmentStatus;
import com.clinic.appointment.entity.PerformedService;
import com.clinic.appointment.repository.AppointmentBillingClosureRepository;
import com.clinic.appointment.repository.AppointmentRepository;
import com.clinic.appointment.repository.PerformedServiceRepository;
import com.clinic.appointment.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PerformedServicesServiceTest {
    private static final String AUTH = "Bearer staff";

    @Mock private AppointmentRepository appointments;
    @Mock private PerformedServiceRepository performedServices;
    @Mock private AppointmentBillingClosureRepository closures;
    @Mock private DoctorClient doctors;
    @InjectMocks private PerformedServicesService service;

    private UUID appointmentId;
    private Appointment appointment;
    private CurrentUserPrincipal admin;

    @BeforeEach
    void setUp() {
        appointmentId = UUID.randomUUID();
        appointment = Appointment.builder().id(appointmentId).patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID()).appointmentDate(LocalDate.now().minusDays(1))
                .status(AppointmentStatus.COMPLETED).build();
        admin = new CurrentUserPrincipal(UUID.randomUUID(), "admin@test.com", "Admin", Set.of("ROLE_ADMIN"));
    }

    @Test
    void completedAppointmentCanBeFinalizedWithImmutableRevision() {
        PerformedService item = PerformedService.builder().id(UUID.randomUUID()).appointmentId(appointmentId)
                .serviceId(UUID.randomUUID()).quantity(1).serviceDate(appointment.getAppointmentDate()).build();
        AppointmentBillingClosure closure = AppointmentBillingClosure.builder()
                .appointmentId(appointmentId).finalized(false).build();
        when(appointments.findByIdForUpdate(appointmentId)).thenReturn(Optional.of(appointment));
        when(closures.findByAppointmentIdForUpdate(appointmentId)).thenReturn(Optional.of(closure));
        when(performedServices.findByAppointmentIdOrderByCreatedAtAsc(appointmentId)).thenReturn(List.of(item));

        var response = service.finalizeForBilling(admin, AUTH, appointmentId);

        assertEquals(true, response.finalized());
        assertNotNull(response.revision());
        assertEquals(item.getServiceId(), response.items().getFirst().serviceId());
        verify(closures).saveAndFlush(closure);
    }

    @Test
    void finalizedAppointmentRejectsAdditionalServices() {
        when(appointments.findByIdForUpdate(appointmentId)).thenReturn(Optional.of(appointment));
        when(closures.findByAppointmentIdForUpdate(appointmentId)).thenReturn(Optional.of(
                AppointmentBillingClosure.builder().appointmentId(appointmentId).finalized(true)
                        .revision("svc-r1").build()));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.add(admin, AUTH,
                appointmentId, new AddPerformedServiceRequest(
                        UUID.randomUUID(), 1, appointment.getAppointmentDate())));

        assertEquals(ErrorCode.CONFLICT, ex.getErrorCode());
        verify(performedServices, never()).save(any());
    }

    @Test
    void doctorCannotModifyAnotherDoctorsAppointment() {
        CurrentUserPrincipal doctor = new CurrentUserPrincipal(UUID.randomUUID(), "doctor@test.com", "Doctor",
                Set.of("ROLE_DOCTOR"));
        when(appointments.findByIdForUpdate(appointmentId)).thenReturn(Optional.of(appointment));
        when(doctors.getCurrentDoctorProfile(AUTH)).thenReturn(new DoctorProfileResponse(UUID.randomUUID(), doctor.id()));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.add(doctor, AUTH,
                appointmentId, new AddPerformedServiceRequest(
                        UUID.randomUUID(), 1, appointment.getAppointmentDate())));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
        verify(closures, never()).findByAppointmentIdForUpdate(any());
    }
}
