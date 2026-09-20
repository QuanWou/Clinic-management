package com.clinic.billing.service.impl;

import com.clinic.billing.client.*;
import com.clinic.billing.dto.*;
import com.clinic.billing.entity.*;
import com.clinic.billing.repository.*;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BillingServiceImplTest {
    private static final String AUTH = "Bearer test";
    private static final BigDecimal FEE = new BigDecimal("250000.00");
    @Mock InvoiceRepository invoices;
    @Mock InvoiceItemRepository items;
    @Mock InvoicePaidOutboxRepository outbox;
    @Mock PaymentTransactionRepository payments;
    @Mock AppointmentClient appointments;
    @Mock PatientClient patients;
    @Mock PricingClient pricing;
    @Mock PerformedServicesClient performed;
    @Mock LabBillingClient laboratory;
    @InjectMocks BillingServiceImpl billing;

    private UUID user, appointmentId, patientId, doctorId, serviceId, itemId;
    private CurrentUserPrincipal cashier, admin, patient;
    private LocalDate visit;

    @BeforeEach void init() {
        user = UUID.randomUUID(); appointmentId = UUID.randomUUID(); patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID(); serviceId = UUID.randomUUID(); itemId = UUID.randomUUID();
        visit = LocalDate.now().minusDays(1);
        cashier = principal("RECEPTIONIST"); admin = principal("ADMIN"); patient = principal("PATIENT");
    }

    private CurrentUserPrincipal principal(String role) {
        return new CurrentUserPrincipal(user, "test@example.test", "Test", Set.of("ROLE_" + role));
    }
    private AppointmentResponse appointment(String status) {
        return new AppointmentResponse(appointmentId, patientId, doctorId, visit, LocalTime.of(9, 0),
                LocalTime.of(10, 0), status, "Checkup", LocalDateTime.now(), LocalDateTime.now());
    }
    private PricingClient.PricedService price(UUID id, LocalDate date) {
        return new PricingClient.PricedService(id, "CONSULT", "Consultation", UUID.randomUUID(), FEE, "VND", date);
    }
    private void sources() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId, List.of(), true, "lab-v1"));
    }
    private void priced() {
        when(pricing.byServiceId(AUTH, serviceId, visit)).thenReturn(price(serviceId, visit));
    }
    private void saved() {
        when(invoices.saveAndFlush(any(Invoice.class))).thenAnswer(call -> {
            Invoice invoice = call.getArgument(0); invoice.setId(UUID.randomUUID()); return invoice;
        });
    }
    private Invoice invoice(UUID id, InvoiceStatus status) {
        return Invoice.builder().id(id).patientId(patientId).appointmentId(appointmentId)
                .totalAmount(FEE).catalogRevision("PRICE_IDS_PER_ITEM").currency("VND")
                .performedRevision("svc-r1").labRevision("lab-v1")
                .status(status).createdAt(LocalDateTime.now()).updatedAt(LocalDateTime.now()).build();
    }
    private InvoiceItem verifiedItem(UUID invoiceId) {
        return InvoiceItem.builder().id(UUID.randomUUID()).invoiceId(invoiceId).sourceType("SERVICE")
                .sourceId(itemId).serviceId(serviceId).serviceCode("CONSULT").serviceName("Consultation")
                .priceId(UUID.randomUUID()).serviceDate(visit).quantity(1).unitPrice(FEE)
                .lineAmount(FEE).currency("VND").build();
    }
    private PaymentTransaction transaction(UUID invoiceId, String reference, PaymentTransactionType type) {
        return PaymentTransaction.builder().id(UUID.randomUUID()).invoiceId(invoiceId)
                .externalReference(reference).type(type).amount(FEE).build();
    }
    private BusinessException createFailure() {
        return assertThrows(BusinessException.class,
                () -> billing.create(user, AUTH, cashier, new CreateInvoiceRequest(appointmentId)));
    }

    @Test void createsInvoiceFromVerifiedServerItemsAndVersions() {
        sources(); priced(); saved();
        var result = billing.create(user, AUTH, cashier, new CreateInvoiceRequest(appointmentId));
        assertEquals(FEE, result.totalAmount()); assertEquals("VND", result.currency());
        assertEquals(InvoiceStatus.UNPAID, result.status());
        verify(items).saveAllAndFlush(argThat(saved -> {
            InvoiceItem first = saved.iterator().next();
            return first.getPriceId() != null && first.getServiceId().equals(serviceId)
                    && first.getSourceId().equals(itemId) && first.getLineAmount().equals(FEE)
                    && first.getInvoiceId() != null;
        }));
    }
    @Test void absentPerformedServicesFailsClosedBeforePricing() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenThrow(new BusinessException(ErrorCode.CONFLICT, "Missing performed services"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(pricing, laboratory, items);
    }
    @Test void unfinishedServicesFailClosed() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                false, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(pricing, items);
    }
    @Test void unavailableLabListFailsClosed() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        when(laboratory.get(AUTH, appointmentId)).thenThrow(new BusinessException(ErrorCode.CONFLICT, "Lab offline"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(pricing, items);
    }
    @Test void currentTask04ResponseWithoutFreezeContractMustFailClosed() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        // Task 04 currently returns just appointmentId and items; an empty list is not a freeze.
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(), null, null));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(pricing, items);
        verify(invoices, never()).saveAndFlush(any());
    }
    @Test void pendingLabOrderBlocksInvoice() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(new LabBillingClient.LabItem(UUID.randomUUID(), "CBC", 1, "ORDERED", null, UUID.randomUUID(), null)), true, "lab-v1"));
        when(pricing.byServiceId(AUTH, serviceId, visit)).thenReturn(price(serviceId, visit));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }
    @Test void releasedLabItemIsPricedByCatalogAndSnapshotted() {
        UUID orderId = UUID.randomUUID(); UUID labService = UUID.randomUUID();
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(appointmentId,
                true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(new LabBillingClient.LabItem(orderId, "CBC", 1, "RELEASED", visit.atStartOfDay(), labService, visit)), true, "lab-v1"));
        priced();
        when(pricing.byServiceId(AUTH, labService, visit)).thenReturn(new PricingClient.PricedService(labService,
                "CBC", "Blood count", UUID.randomUUID(), new BigDecimal("50000.00"), "VND", visit));
        saved();
        var result = billing.create(user, AUTH, cashier, new CreateInvoiceRequest(appointmentId));
        assertEquals(new BigDecimal("300000.00"), result.totalAmount());
        verify(items).saveAllAndFlush(argThat(saved -> {
            int count = 0; boolean labFound = false;
            for (InvoiceItem line : saved) { count++; if ("LAB".equals(line.getSourceType())) {
                labFound = orderId.equals(line.getSourceId()) && "CBC".equals(line.getServiceCode())
                        && new BigDecimal("50000.00").equals(line.getLineAmount());
            }}
            return count == 2 && labFound;
        }));
    }
    @Test void missingPriceFailsWithoutInvoice() {
        sources();
        when(pricing.byServiceId(AUTH, serviceId, visit)).thenThrow(new BusinessException(ErrorCode.CONFLICT, "No price"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }
    @Test void invalidPriceFailsWithoutInvoice() {
        sources();
        when(pricing.byServiceId(AUTH, serviceId, visit)).thenReturn(new PricingClient.PricedService(serviceId,
                "CONSULT", "Consultation", UUID.randomUUID(), BigDecimal.ZERO, "VND", visit));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }
    @Test void duplicateSourceInSameRequestFails() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        var duplicate = new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit);
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(
                appointmentId, true, "svc-r1", List.of(duplicate, duplicate)));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId, List.of(), true, "lab-v1"));
        priced();
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }
    @Test void duplicateInvoicePrecheckIsConflict() {
        when(invoices.existsByAppointmentId(appointmentId)).thenReturn(true);
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(performed, laboratory, pricing);
    }
    @Test void concurrentUniqueViolationForInvoiceOrLabReturnsConflict() {
        sources(); priced(); saved();
        when(items.saveAllAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate lab source"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
    }
    @Test void incompleteAppointmentCannotCreateInvoice() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("CONFIRMED"));
        assertEquals(ErrorCode.VALIDATION_ERROR, createFailure().getErrorCode());
        verifyNoInteractions(performed, laboratory, pricing);
    }
    @Test void patientCannotCreateOrConfirmCash() {
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> billing.create(user, AUTH, patient, new CreateInvoiceRequest(appointmentId))).getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(patient, UUID.randomUUID(), new CashPaymentRequest("RECEIPT"))).getErrorCode());
        verifyNoInteractions(invoices, payments, outbox);
    }
    @Test void cashCaptureRequiresItemsAndWritesOneDurableEventIntent() {
        UUID id = UUID.randomUUID(); Invoice invoice = invoice(id, InvoiceStatus.UNPAID);
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        when(items.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(id)).thenReturn(List.of(verifiedItem(id)));
        when(invoices.save(invoice)).thenReturn(invoice);
        var result = billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1"));
        assertEquals(InvoiceStatus.PAID, result.status()); assertEquals(user, result.paidBy());
        verify(payments).saveAndFlush(argThat(tx -> tx.getType() == PaymentTransactionType.CAPTURE
                && id.equals(tx.getInvoiceId()) && user.equals(tx.getConfirmedBy())));
        verify(outbox).saveAndFlush(argThat(event -> id.equals(event.getInvoiceId())
                && "INVOICE_PAID".equals(event.getEventType()) && "WAITING_RECIPIENT".equals(event.getStatus())
                && patientId.equals(event.getPatientId()) && event.getRecipientUserId() == null));
    }
    @Test void legacyUnverifiedInvoiceCannotCaptureCash() {
        UUID id = UUID.randomUUID(); Invoice invoice = invoice(id, InvoiceStatus.UNPAID);
        invoice.setCatalogRevision(null); invoice.setCurrency(null);
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1"))).getErrorCode());
        verifyNoInteractions(payments, outbox);
    }
    @Test void cashRetrySameReceiptDoesNotDuplicateTransactionOrEvent() {
        UUID id = UUID.randomUUID();
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice(id, InvoiceStatus.PAID)));
        when(payments.findByInvoiceIdAndType(id, PaymentTransactionType.CAPTURE))
                .thenReturn(Optional.of(transaction(id, "R1", PaymentTransactionType.CAPTURE)));
        assertEquals(InvoiceStatus.PAID, billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1")).status());
        verify(payments, never()).saveAndFlush(any()); verifyNoInteractions(outbox);
    }
    @Test void cashRetryDifferentReceiptFails() {
        UUID id = UUID.randomUUID();
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice(id, InvoiceStatus.PAID)));
        when(payments.findByInvoiceIdAndType(id, PaymentTransactionType.CAPTURE))
                .thenReturn(Optional.of(transaction(id, "R1", PaymentTransactionType.CAPTURE)));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R2"))).getErrorCode());
        verifyNoInteractions(outbox);
    }
    @Test void cashReferenceRaceIsConflictAndDoesNotWriteOutbox() {
        UUID id = UUID.randomUUID(); Invoice invoice = invoice(id, InvoiceStatus.UNPAID);
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        when(items.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(id)).thenReturn(List.of(verifiedItem(id)));
        when(payments.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate receipt"));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1"))).getErrorCode());
        verifyNoInteractions(outbox);
    }
    @Test void paidInvoiceCannotCancel() {
        UUID id = UUID.randomUUID();
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice(id, InvoiceStatus.PAID)));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.cancel(cashier, id)).getErrorCode());
    }
    @Test void adminCashRefundRequiresVerifiedCapture() {
        UUID id = UUID.randomUUID(); Invoice invoice = invoice(id, InvoiceStatus.PAID);
        invoice.setPaymentMethod(PaymentMethod.CASH);
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        when(payments.findByInvoiceIdAndType(id, PaymentTransactionType.CAPTURE))
                .thenReturn(Optional.of(transaction(id, "R1", PaymentTransactionType.CAPTURE)));
        when(invoices.save(invoice)).thenReturn(invoice);
        assertEquals(InvoiceStatus.REFUNDED, billing.confirmCashRefund(admin, id,
                new CashRefundRequest("REF-1", "Duplicate payment")).status());
        verify(payments).saveAndFlush(argThat(tx -> tx.getType() == PaymentTransactionType.REFUND
                && user.equals(tx.getConfirmedBy())));
    }

    @Test void duplicateLabOrderCannotBeChargedTwiceInOneInvoice() {
        UUID order = UUID.randomUUID();
        var duplicate = new LabBillingClient.LabItem(order, "CBC", 1, "RELEASED", visit.atStartOfDay(), UUID.randomUUID(), visit);
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(
                appointmentId, true, "svc-r1", List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(duplicate, duplicate), true, "lab-v1"));
        priced();
        // No second charge may be persisted for the same order ID.
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }

    @Test void invoiceUniqueAppointmentRaceIsConflict() {
        sources(); priced();
        when(invoices.saveAndFlush(any(Invoice.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate appointment"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(items, never()).saveAllAndFlush(any());
    }

    @Test void cashCaptureChecksSnapshotTotal() {
        UUID id = UUID.randomUUID();
        Invoice invoice = invoice(id, InvoiceStatus.UNPAID);
        InvoiceItem invalid = verifiedItem(id);
        invalid.setLineAmount(FEE.add(BigDecimal.ONE));
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        when(items.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(id)).thenReturn(List.of(invalid));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1"))).getErrorCode());
        verifyNoInteractions(payments, outbox);
    }

    @Test void cancelledInvoiceCannotCapture() {
        UUID id = UUID.randomUUID();
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice(id, InvoiceStatus.CANCELLED)));
        assertEquals(ErrorCode.CONFLICT, assertThrows(BusinessException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1"))).getErrorCode());
        verifyNoInteractions(payments, outbox);
    }

    @Test void cashierCannotRefundAndDoesNotAccessInvoice() {
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(BusinessException.class,
                () -> billing.confirmCashRefund(cashier, UUID.randomUUID(),
                        new CashRefundRequest("REF-1", "Reason"))).getErrorCode());
        verifyNoInteractions(invoices, payments, outbox);
    }

    @Test void refundRetrySameReferenceDoesNotWriteAgain() {
        UUID id = UUID.randomUUID();
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice(id, InvoiceStatus.REFUNDED)));
        when(payments.findByInvoiceIdAndType(id, PaymentTransactionType.REFUND))
                .thenReturn(Optional.of(transaction(id, "REF-1", PaymentTransactionType.REFUND)));
        assertEquals(InvoiceStatus.REFUNDED, billing.confirmCashRefund(admin, id,
                new CashRefundRequest("REF-1", "Duplicate payment")).status());
        verify(payments, never()).saveAndFlush(any());
        verify(invoices, never()).save(any());
    }

    @Test void failedOutboxPersistenceCannotReturnSuccessfulCashCapture() {
        UUID id = UUID.randomUUID(); Invoice invoice = invoice(id, InvoiceStatus.UNPAID);
        when(invoices.findByIdForUpdate(id)).thenReturn(Optional.of(invoice));
        when(items.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(id)).thenReturn(List.of(verifiedItem(id)));
        when(outbox.saveAndFlush(any(InvoicePaidOutbox.class)))
                .thenThrow(new DataIntegrityViolationException("outbox uniqueness violation"));
        assertThrows(DataIntegrityViolationException.class,
                () -> billing.confirmCashPayment(cashier, id, new CashPaymentRequest("R1")));
        verify(invoices, never()).save(any());
        // In production @Transactional rolls back the captured transaction; PostgreSQL test pending.
    }

    @Test void changedPerformedRevisionBeforeSaveDoesNotIssueInvoice() {
        var lines = List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit));
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(
                new PerformedServicesClient.PerformedServices(appointmentId, true, "svc-r1", lines),
                new PerformedServicesClient.PerformedServices(appointmentId, true, "svc-r2", lines));
        when(laboratory.get(AUTH, appointmentId)).thenReturn(
                new LabBillingClient.LabItems(appointmentId, List.of(), true, "lab-v1"));
        priced();
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
        verify(items, never()).saveAllAndFlush(any());
    }

    @Test void changedLabRevisionBeforeSaveDoesNotIssueInvoice() {
        sources(); priced();
        var original = new LabBillingClient.LabItems(appointmentId, List.of(), true, "lab-v1");
        var changed = new LabBillingClient.LabItems(appointmentId, List.of(), true, "lab-v2");
        when(laboratory.get(AUTH, appointmentId)).thenReturn(original, changed);
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
        verify(items, never()).saveAllAndFlush(any());
    }

    @Test void releasedLabWithoutVerifiedServiceIdCannotBeInvoiced() {
        sources(); priced();
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(new LabBillingClient.LabItem(UUID.randomUUID(), "CBC", 1, "RELEASED",
                        visit.atStartOfDay(), null, visit)), true, "lab-v1"));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }

    @Test void labCodeMustMatchCatalogServiceId() {
        UUID labServiceId = UUID.randomUUID();
        sources(); priced();
        when(laboratory.get(AUTH, appointmentId)).thenReturn(new LabBillingClient.LabItems(appointmentId,
                List.of(new LabBillingClient.LabItem(UUID.randomUUID(), "CBC", 1, "RELEASED",
                        visit.atStartOfDay(), labServiceId, visit)), true, "lab-v1"));
        when(pricing.byServiceId(AUTH, labServiceId, visit)).thenReturn(new PricingClient.PricedService(
                labServiceId, "DIFFERENT", "Different service", UUID.randomUUID(), FEE, "VND", visit));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verify(invoices, never()).saveAndFlush(any());
    }

    @Test void finalizedPerformedServicesWithoutRevisionFailClosed() {
        when(appointments.getById(AUTH, appointmentId)).thenReturn(appointment("COMPLETED"));
        when(performed.get(AUTH, appointmentId)).thenReturn(new PerformedServicesClient.PerformedServices(
                appointmentId, true, null,
                List.of(new PerformedServicesClient.PerformedItem(itemId, serviceId, 1, visit))));
        assertEquals(ErrorCode.CONFLICT, createFailure().getErrorCode());
        verifyNoInteractions(laboratory, pricing, items);
    }
}
