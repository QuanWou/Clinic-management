package com.clinic.billing.service.impl;

import com.clinic.billing.client.AppointmentClient;
import com.clinic.billing.client.AppointmentResponse;
import com.clinic.billing.client.PatientClient;
import com.clinic.billing.client.PricingClient;
import com.clinic.billing.client.PerformedServicesClient;
import com.clinic.billing.client.LabBillingClient;
import com.clinic.billing.dto.InvoiceItemResponse;
import com.clinic.billing.dto.CashPaymentRequest;
import com.clinic.billing.dto.CashRefundRequest;
import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.PaymentTransactionResponse;
import com.clinic.billing.entity.Invoice;
import com.clinic.billing.entity.InvoiceItem;
import com.clinic.billing.entity.InvoicePaidOutbox;
import com.clinic.billing.entity.InvoiceStatus;
import com.clinic.billing.entity.PaymentMethod;
import com.clinic.billing.entity.PaymentTransaction;
import com.clinic.billing.entity.PaymentTransactionType;
import com.clinic.billing.repository.InvoiceRepository;
import com.clinic.billing.repository.InvoiceItemRepository;
import com.clinic.billing.repository.InvoicePaidOutboxRepository;
import com.clinic.billing.repository.PaymentTransactionRepository;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.billing.service.BillingService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingServiceImpl implements BillingService {

    private static final String COMPLETED_STATUS = "COMPLETED";

    private final InvoiceRepository invoiceRepository;
    private final AppointmentClient appointmentClient;
    private final PatientClient patientClient;
    private final PricingClient pricingClient;
    private final PaymentTransactionRepository transactionRepository;
    private final PerformedServicesClient performedServicesClient;
    private final LabBillingClient labBillingClient;
    private final InvoiceItemRepository invoiceItemRepository;
    private final InvoicePaidOutboxRepository paidOutboxRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<InvoiceResponse> getStaffInvoices(CurrentUserPrincipal principal, int page, int size) {
        if (principal == null || (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only administrators or receptionists can list clinic invoices");
        }
        if (page < 0 || size < 1 || size > 50) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invoice page or size is invalid");
        }
        return invoiceRepository.findAll(PageRequest.of(page, size,
                        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .map(this::toResponse);
    }

    @Override
    @Transactional
    public InvoiceResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateInvoiceRequest request) {
        log.info("User {} is creating invoice for appointment {}", currentUserId, request.appointmentId());

        if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only admins or receptionists can create invoices");
        }

        if (invoiceRepository.existsByAppointmentId(request.appointmentId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice already exists for this appointment");
        }

        AppointmentResponse appointment = appointmentClient.getById(authorizationHeader, request.appointmentId());
        if (!COMPLETED_STATUS.equals(appointment.status())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invoice can only be created for completed appointments");
        }

        if (!request.appointmentId().equals(appointment.id()) || appointment.patientId() == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Appointment response invalid");
        }

        PerformedServicesClient.PerformedServices performed =
                performedServicesClient.get(authorizationHeader, appointment.id());
        if (performed == null || !appointment.id().equals(performed.appointmentId())
                || !performed.finalized() || performed.revision() == null || performed.revision().isBlank() || performed.revision().length() > 100
                || performed.items() == null || performed.items().isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Appointment performed services are missing, unfinished or not verified");
        }

        LabBillingClient.LabItems laboratory = labBillingClient.get(authorizationHeader, appointment.id());
        if (laboratory == null || !appointment.id().equals(laboratory.appointmentId())
                || laboratory.items() == null) {
            throw new BusinessException(ErrorCode.CONFLICT, "Laboratory billing data unavailable");
        }
        if (!Boolean.TRUE.equals(laboratory.finalizedForBilling())
                || laboratory.billableRevision() == null || laboratory.billableRevision().isBlank()
                || laboratory.billableRevision().length() > 100) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Laboratory billable items are not frozen/finalized; later orders could be omitted");
        }

        List<InvoiceItem> snapshots = new ArrayList<>();
        Set<UUID> serviceSources = new HashSet<>();
        Set<UUID> performedServiceIds = new HashSet<>();
        for (PerformedServicesClient.PerformedItem item : performed.items()) {
            if (item == null || item.performedItemId() == null || item.serviceId() == null
                    || item.quantity() <= 0 || item.serviceDate() == null
                    || item.serviceDate().isAfter(LocalDate.now())
                    || !serviceSources.add(item.performedItemId())) {
                throw new BusinessException(ErrorCode.CONFLICT, "Performed service is incomplete or duplicated");
            }
            performedServiceIds.add(item.serviceId());
            snapshots.add(snapshot("SERVICE", item.performedItemId(), item.quantity(),
                    pricingClient.byServiceId(authorizationHeader, item.serviceId(), item.serviceDate())));
        }

        Set<UUID> labSources = new HashSet<>();
        for (LabBillingClient.LabItem lab : laboratory.items()) {
            if (lab == null || lab.orderId() == null || !labSources.add(lab.orderId())
                    || lab.serviceId() == null || lab.performedOn() == null
                    || lab.performedOn().isAfter(LocalDate.now())
                    || lab.testCode() == null || lab.testCode().isBlank()
                    || lab.quantity() <= 0 || !"RELEASED".equals(lab.status()) || lab.billableAt() == null
                    || lab.billableAt().isAfter(LocalDateTime.now())) {
                throw new BusinessException(ErrorCode.CONFLICT, "Lab order is pending, invalid or duplicated; cannot invoice");
            }
            if (performedServiceIds.contains(lab.serviceId())) {
                throw new BusinessException(ErrorCode.CONFLICT,
                        "Service appears in both performed-service and laboratory sources");
            }
            snapshots.add(snapshot("LAB", lab.orderId(), lab.quantity(),
                    verifiedLabPrice(authorizationHeader, lab)));
        }
        BigDecimal total = snapshots.stream().map(InvoiceItem::getLineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.signum() <= 0 || total.precision() - total.scale() > 10) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice sum is invalid or exceeds supported limits");
        }

        Invoice invoice = Invoice.builder()
                .appointmentId(appointment.id())
                .patientId(appointment.patientId())
                .totalAmount(total.setScale(2))
                .currency("VND")
                .catalogRevision("PRICE_IDS_PER_ITEM")
                .performedRevision(performed.revision())
                .labRevision(laboratory.billableRevision())
                .status(InvoiceStatus.UNPAID)
                .build();

        // Detect changed upstream versions immediately before committing the local invoice.
        // An immutable finalization protocol is still required to eliminate cross-service races.
        verifySourcesUnchanged(authorizationHeader, appointment, performed, laboratory);
        try {
            invoiceRepository.saveAndFlush(invoice);
            if (invoice.getId() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "Invoice ID missing after save");
            }
            for (InvoiceItem item : snapshots) {
                item.setInvoiceId(invoice.getId());
            }
            invoiceItemRepository.saveAllAndFlush(snapshots);
            return toResponse(invoice);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice, performed service or lab order already billed");
        }
    }

    private PricingClient.PricedService verifiedLabPrice(String authorization, LabBillingClient.LabItem lab) {
        PricingClient.PricedService price = pricingClient.byServiceId(
                authorization, lab.serviceId(), lab.performedOn());
        if (price == null || !lab.serviceId().equals(price.serviceId())
                || price.code() == null || !lab.testCode().equalsIgnoreCase(price.code())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Lab order does not match its catalog service ID");
        }
        return price;
    }

    private void verifySourcesUnchanged(String authorization, AppointmentResponse original,
                                        PerformedServicesClient.PerformedServices performed,
                                        LabBillingClient.LabItems laboratory) {
        AppointmentResponse current = appointmentClient.getById(authorization, original.id());
        if (current == null || !COMPLETED_STATUS.equals(current.status())
                || !original.id().equals(current.id()) || !original.patientId().equals(current.patientId())
                || original.appointmentDate() == null
                || !original.appointmentDate().equals(current.appointmentDate())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Appointment changed while preparing invoice");
        }
        PerformedServicesClient.PerformedServices currentServices = performedServicesClient.get(authorization, original.id());
        LabBillingClient.LabItems currentLabs = labBillingClient.get(authorization, original.id());
        if (!performed.equals(currentServices) || !laboratory.equals(currentLabs)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Billable revision or item list changed while preparing invoice");
        }
    }

    private InvoiceItem snapshot(String type, UUID sourceId, int quantity, PricingClient.PricedService price) {
        if (price == null || price.serviceId() == null || price.priceId() == null
                || price.unitPrice() == null || price.unitPrice().signum() <= 0
                || price.unitPrice().scale() > 2 || !"VND".equals(price.currency())
                || price.code() == null || price.code().isBlank() || price.code().length() > 60
                || price.name() == null || price.name().isBlank() || price.name().length() > 255
                || price.serviceDate() == null) {
            throw new BusinessException(ErrorCode.CONFLICT, "Authoritative catalog price invalid");
        }
        BigDecimal line = price.unitPrice().multiply(BigDecimal.valueOf(quantity));
        if (line.signum() <= 0 || line.precision() - line.scale() > 10) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice item amount out of bounds");
        }
        return InvoiceItem.builder().sourceType(type).sourceId(sourceId)
                .serviceId(price.serviceId()).serviceCode(price.code()).serviceName(price.name())
                .priceId(price.priceId()).serviceDate(price.serviceDate())
                .unitPrice(price.unitPrice()).quantity(quantity).lineAmount(line)
                .currency(price.currency()).build();
    }

    @Override
    @Transactional(readOnly = true)
    public InvoiceResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID invoiceId) {
        log.info("Fetching invoice {} for user {}", invoiceId, currentUserId);
        Invoice invoice = getInvoiceById(invoiceId);
        authorizeRead(authorizationHeader, principal, invoice);
        return toResponse(invoice);
    }

    @Override
    @Transactional(readOnly = true)
    public InvoiceResponse getByAppointmentId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId) {
        log.info("Fetching invoice for appointment {} by user {}", appointmentId, currentUserId);
        Invoice invoice = invoiceRepository.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Invoice not found"));
        authorizeRead(authorizationHeader, principal, invoice);
        return toResponse(invoice);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvoiceResponse> getMyInvoices(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal) {
        log.info("Fetching invoices for current patient user {}", currentUserId);

        if (!principal.hasRole("PATIENT")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only patients can view their own invoices through this endpoint");
        }

        UUID patientId = patientClient.getCurrentPatientProfile(authorizationHeader).id();
        return invoiceRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InvoiceResponse> getByPatientId(UUID currentUserId, CurrentUserPrincipal principal, UUID patientId) {
        log.info("Fetching invoices for patient {} by user {}", patientId, currentUserId);

        if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view patient invoices");
        }

        return invoiceRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public InvoiceResponse confirmCashPayment(CurrentUserPrincipal principal, UUID invoiceId, CashPaymentRequest request) {
        requireCashier(principal);
        Invoice invoice = getInvoiceForUpdate(invoiceId);
        if (invoice.getStatus() == InvoiceStatus.PAID) {
            PaymentTransaction previous = transactionRepository
                    .findByInvoiceIdAndType(invoiceId, PaymentTransactionType.CAPTURE).orElse(null);
            if (previous != null && previous.getExternalReference().equals(request.receiptReference())) {
                return toResponse(invoice); // Retried confirmation; do not create a second capture.
            }
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice is already paid");
        }
        requireUnpaid(invoice);
        requireVerifiedSnapshot(invoice);
        ensureReferenceAvailable(request.receiptReference());
        LocalDateTime now = LocalDateTime.now();
        persistCashTransaction(cashTransaction(invoice, PaymentTransactionType.CAPTURE,
                request.receiptReference(), principal.id(), now, null));
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaymentMethod(PaymentMethod.CASH);
        invoice.setPaidAt(now);
        invoice.setPaidBy(principal.id());
        paidOutboxRepository.saveAndFlush(InvoicePaidOutbox.builder()
                .eventId(UUID.randomUUID()).invoiceId(invoiceId).patientId(invoice.getPatientId())
                .eventType("INVOICE_PAID").status("WAITING_RECIPIENT")
                .nextAttemptAt(now).build());
        log.info("Cash receipt confirmed for invoice {} by cashier {}", invoiceId, principal.id());
        return toResponse(invoiceRepository.save(invoice));
    }

    private void requireVerifiedSnapshot(Invoice invoice) {
        if (!"VND".equals(invoice.getCurrency()) || invoice.getCatalogRevision() == null
                || invoice.getCatalogRevision().isBlank() || invoice.getPerformedRevision() == null
                || invoice.getPerformedRevision().isBlank() || invoice.getLabRevision() == null
                || invoice.getLabRevision().isBlank()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice has no verified price snapshot; reconcile first");
        }
        List<InvoiceItem> items = invoiceItemRepository.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(invoice.getId());
        if (items == null || items.isEmpty() || items.stream().anyMatch(item -> item.getPriceId() == null
                || !"VND".equals(item.getCurrency()) || item.getLineAmount() == null
                || item.getUnitPrice() == null || item.getQuantity() == null || item.getQuantity() <= 0
                || item.getLineAmount().compareTo(item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()))) != 0)
                || items.stream().map(InvoiceItem::getLineAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(invoice.getTotalAmount()) != 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice item snapshot incomplete or inconsistent; cannot capture funds");
        }
    }

    @Override
    @Transactional
    public InvoiceResponse confirmCashRefund(CurrentUserPrincipal principal, UUID invoiceId, CashRefundRequest request) {
        if (!principal.hasRole("ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only admins can confirm cash refunds");
        }
        Invoice invoice = getInvoiceForUpdate(invoiceId);
        if (invoice.getStatus() == InvoiceStatus.REFUNDED) {
            PaymentTransaction previous = transactionRepository
                    .findByInvoiceIdAndType(invoiceId, PaymentTransactionType.REFUND).orElse(null);
            if (previous != null && previous.getExternalReference().equals(request.refundReference())) {
                return toResponse(invoice);
            }
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice has already been refunded");
        }
        if (invoice.getStatus() != InvoiceStatus.PAID || invoice.getPaymentMethod() != PaymentMethod.CASH) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only paid cash invoices can be refunded at the cash register");
        }
        // Do not refund historical/unaudited invoices without a verified capture.
        if (transactionRepository.findByInvoiceIdAndType(invoiceId, PaymentTransactionType.CAPTURE).isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cash capture evidence missing; reconcile invoice first");
        }
        ensureReferenceAvailable(request.refundReference());
        LocalDateTime now = LocalDateTime.now();
        persistCashTransaction(cashTransaction(invoice, PaymentTransactionType.REFUND,
                request.refundReference(), principal.id(), now, request.reason()));
        invoice.setStatus(InvoiceStatus.REFUNDED);
        invoice.setRefundedAt(now);
        invoice.setRefundedBy(principal.id());
        log.info("Cash refund confirmed for invoice {} by admin {}", invoiceId, principal.id());
        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    @Transactional
    public InvoiceResponse cancel(CurrentUserPrincipal principal, UUID invoiceId) {
        requireCashier(principal);
        Invoice invoice = getInvoiceForUpdate(invoiceId);
        requireUnpaid(invoice);
        invoice.setStatus(InvoiceStatus.CANCELLED);
        invoice.setCancelledBy(principal.id());
        invoice.setCancelledAt(LocalDateTime.now());
        return toResponse(invoiceRepository.save(invoice));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentTransactionResponse> getTransactions(CurrentUserPrincipal principal, UUID invoiceId) {
        requireCashier(principal);
        getInvoiceById(invoiceId);
        return transactionRepository.findByInvoiceIdOrderByConfirmedAtAsc(invoiceId).stream()
                .map(tx -> new PaymentTransactionResponse(tx.getId(), tx.getInvoiceId(), tx.getType(),
                        tx.getProvider(), tx.getExternalReference(), tx.getAmount(), tx.getCurrency(),
                        tx.getStatus(), tx.getConfirmedBy(), tx.getConfirmedAt(), tx.getReason()))
                .toList();
    }

    private void requireCashier(CurrentUserPrincipal principal) {
        if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only admins or receptionists can confirm cash transactions");
        }
    }

    private void requireUnpaid(Invoice invoice) {
        if (invoice.getStatus() != InvoiceStatus.UNPAID) {
            throw new BusinessException(ErrorCode.CONFLICT, "Only unpaid invoices can be modified");
        }
    }

    private void ensureReferenceAvailable(String reference) {
        if (transactionRepository.findByExternalReference(reference).isPresent()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Receipt reference already used");
        }
    }

    private void persistCashTransaction(PaymentTransaction transaction) {
        try {
            // Enforce uniqueness at the database boundary even if another cashier races this check.
            transactionRepository.saveAndFlush(transaction);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cash transaction already exists or receipt reference was reused");
        }
    }

    private PaymentTransaction cashTransaction(Invoice invoice, PaymentTransactionType type,
                                                String reference, UUID staffId, LocalDateTime time, String reason) {
        return PaymentTransaction.builder()
                .invoiceId(invoice.getId())
                .type(type)
                .provider("CASH_REGISTER")
                .externalReference(reference)
                .amount(invoice.getTotalAmount())
                .currency("VND")
                .status("SUCCEEDED")
                .confirmedBy(staffId)
                .confirmedAt(time)
                .reason(reason)
                .build();
    }

    private Invoice getInvoiceForUpdate(UUID invoiceId) {
        return invoiceRepository.findByIdForUpdate(invoiceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Invoice not found"));
    }

    private Invoice getInvoiceById(UUID invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Invoice not found"));
    }

    private void authorizeRead(String authorizationHeader, CurrentUserPrincipal principal, Invoice invoice) {
        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST")) {
            return;
        }

        if (principal.hasRole("PATIENT")) {
            UUID patientId = patientClient.getCurrentPatientProfile(authorizationHeader).id();
            if (invoice.getPatientId().equals(patientId)) {
                return;
            }
        }

        throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to view this invoice");
    }

    private InvoiceResponse toResponse(Invoice invoice) {
        return new InvoiceResponse(
                invoice.getId(),
                invoice.getPatientId(),
                invoice.getAppointmentId(),
                invoice.getTotalAmount(),
                invoice.getCatalogRevision(),
                invoice.getCurrency(),
                invoiceItemRepository.findByInvoiceIdOrderBySourceTypeAscSourceIdAsc(invoice.getId()).stream()
                        .map(item -> new InvoiceItemResponse(item.getId(), item.getSourceType(), item.getSourceId(),
                                item.getServiceId(), item.getServiceCode(), item.getServiceName(), item.getPriceId(),
                                item.getServiceDate(), item.getUnitPrice(), item.getQuantity(),
                                item.getLineAmount(), item.getCurrency()))
                        .toList(),
                invoice.getStatus(),
                invoice.getPaymentMethod(),
                invoice.getPaidAt(),
                invoice.getPaidBy(),
                invoice.getRefundedAt(),
                invoice.getRefundedBy(),
                invoice.getCancelledAt(),
                invoice.getCancelledBy(),
                invoice.getCreatedAt(),
                invoice.getUpdatedAt()
        );
    }
}
