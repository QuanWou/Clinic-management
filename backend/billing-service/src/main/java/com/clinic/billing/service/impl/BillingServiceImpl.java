package com.clinic.billing.service.impl;

import com.clinic.billing.client.AppointmentClient;
import com.clinic.billing.client.AppointmentResponse;
import com.clinic.billing.client.PatientClient;
import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.PayInvoiceRequest;
import com.clinic.billing.entity.Invoice;
import com.clinic.billing.entity.InvoiceStatus;
import com.clinic.billing.repository.InvoiceRepository;
import com.clinic.billing.security.CurrentUserPrincipal;
import com.clinic.billing.service.BillingService;
import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingServiceImpl implements BillingService {

    private static final String COMPLETED_STATUS = "COMPLETED";

    private final InvoiceRepository invoiceRepository;
    private final AppointmentClient appointmentClient;
    private final PatientClient patientClient;

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

        Invoice invoice = Invoice.builder()
                .appointmentId(appointment.id())
                .patientId(appointment.patientId())
                .totalAmount(request.totalAmount())
                .status(InvoiceStatus.UNPAID)
                .build();

        return toResponse(invoiceRepository.save(invoice));
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
    public InvoiceResponse pay(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID invoiceId, PayInvoiceRequest request) {
        log.info("User {} is paying invoice {}", currentUserId, invoiceId);
        Invoice invoice = getInvoiceById(invoiceId);

        if (invoice.getStatus() == InvoiceStatus.PAID) {
            throw new BusinessException(ErrorCode.CONFLICT, "Invoice is already paid");
        }

        if (invoice.getStatus() == InvoiceStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot pay a cancelled invoice");
        }

        if (principal.hasRole("PATIENT")) {
            UUID patientId = patientClient.getCurrentPatientProfile(authorizationHeader).id();
            if (!invoice.getPatientId().equals(patientId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to pay this invoice");
            }
        } else if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to pay invoices");
        }

        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaymentMethod(request.paymentMethod());
        invoice.setPaidAt(LocalDateTime.now());

        return toResponse(invoiceRepository.save(invoice));
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
                invoice.getStatus(),
                invoice.getPaymentMethod(),
                invoice.getPaidAt(),
                invoice.getCreatedAt(),
                invoice.getUpdatedAt()
        );
    }
}
