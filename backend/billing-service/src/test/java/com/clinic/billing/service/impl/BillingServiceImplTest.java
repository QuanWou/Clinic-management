package com.clinic.billing.service.impl;

import com.clinic.billing.client.AppointmentClient;
import com.clinic.billing.client.AppointmentResponse;
import com.clinic.billing.client.PatientClient;
import com.clinic.billing.client.PatientProfileResponse;
import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.PayInvoiceRequest;
import com.clinic.billing.entity.Invoice;
import com.clinic.billing.entity.InvoiceStatus;
import com.clinic.billing.entity.PaymentMethod;
import com.clinic.billing.repository.InvoiceRepository;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BillingServiceImplTest {

    private static final String AUTHORIZATION = "Bearer token";

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private AppointmentClient appointmentClient;

    @Mock
    private PatientClient patientClient;

    @InjectMocks
    private BillingServiceImpl billingService;

    private UUID currentUserId;
    private UUID appointmentId;
    private UUID patientId;
    private UUID doctorId;
    private CurrentUserPrincipal receptionistPrincipal;

    @BeforeEach
    void setUp() {
        currentUserId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();
        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        receptionistPrincipal = new CurrentUserPrincipal(currentUserId, "reception@test.com", "Reception", Set.of("RECEPTIONIST"));
    }

    @Test
    void createShouldSaveUnpaidInvoiceWhenAppointmentIsCompleted() {
        CreateInvoiceRequest request = new CreateInvoiceRequest(appointmentId, BigDecimal.valueOf(250000));

        when(invoiceRepository.existsByAppointmentId(appointmentId)).thenReturn(false);
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> {
            Invoice invoice = invocation.getArgument(0);
            invoice.setId(UUID.randomUUID());
            invoice.setCreatedAt(LocalDateTime.now());
            invoice.setUpdatedAt(LocalDateTime.now());
            return invoice;
        });

        var response = billingService.create(currentUserId, AUTHORIZATION, receptionistPrincipal, request);

        assertEquals(patientId, response.patientId());
        assertEquals(appointmentId, response.appointmentId());
        assertEquals(InvoiceStatus.UNPAID, response.status());
        assertEquals(BigDecimal.valueOf(250000), response.totalAmount());
    }

    @Test
    void createShouldThrowWhenInvoiceAlreadyExistsForAppointment() {
        when(invoiceRepository.existsByAppointmentId(appointmentId)).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> billingService.create(currentUserId, AUTHORIZATION, receptionistPrincipal, new CreateInvoiceRequest(appointmentId, BigDecimal.TEN))
        );

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
    }

    @Test
    void createShouldThrowWhenAppointmentIsNotCompleted() {
        when(invoiceRepository.existsByAppointmentId(appointmentId)).thenReturn(false);
        when(appointmentClient.getById(AUTHORIZATION, appointmentId)).thenReturn(appointment("CONFIRMED"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> billingService.create(currentUserId, AUTHORIZATION, receptionistPrincipal, new CreateInvoiceRequest(appointmentId, BigDecimal.TEN))
        );

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
    }

    @Test
    void payShouldAllowPatientWhoOwnsInvoice() {
        UUID invoiceId = UUID.randomUUID();
        UUID patientUserId = UUID.randomUUID();
        CurrentUserPrincipal patientPrincipal = new CurrentUserPrincipal(patientUserId, "patient@test.com", "Patient", Set.of("PATIENT"));
        Invoice invoice = invoice(InvoiceStatus.UNPAID);

        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
        when(patientClient.getCurrentPatientProfile(AUTHORIZATION)).thenReturn(patientProfile(patientUserId));
        when(invoiceRepository.save(any(Invoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = billingService.pay(patientUserId, AUTHORIZATION, patientPrincipal, invoiceId, new PayInvoiceRequest(PaymentMethod.CARD));

        assertEquals(InvoiceStatus.PAID, response.status());
        assertEquals(PaymentMethod.CARD, response.paymentMethod());
        assertNotNull(response.paidAt());
    }

    @Test
    void payShouldThrowWhenInvoiceAlreadyPaid() {
        UUID invoiceId = UUID.randomUUID();
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice(InvoiceStatus.PAID)));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> billingService.pay(currentUserId, AUTHORIZATION, receptionistPrincipal, invoiceId, new PayInvoiceRequest(PaymentMethod.CASH))
        );

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
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

    private Invoice invoice(InvoiceStatus status) {
        return Invoice.builder()
                .id(UUID.randomUUID())
                .patientId(patientId)
                .appointmentId(appointmentId)
                .totalAmount(BigDecimal.valueOf(250000))
                .status(status)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
