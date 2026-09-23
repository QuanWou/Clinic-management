package com.clinic.billing.service;

import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.CashPaymentRequest;
import com.clinic.billing.dto.CashRefundRequest;
import com.clinic.billing.dto.PaymentTransactionResponse;
import com.clinic.billing.security.CurrentUserPrincipal;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.UUID;

public interface BillingService {

    Page<InvoiceResponse> getStaffInvoices(CurrentUserPrincipal principal, int page, int size);

    InvoiceResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateInvoiceRequest request);

    InvoiceResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID invoiceId);

    InvoiceResponse getByAppointmentId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    List<InvoiceResponse> getMyInvoices(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal);

    List<InvoiceResponse> getByPatientId(UUID currentUserId, CurrentUserPrincipal principal, UUID patientId);

    InvoiceResponse confirmCashPayment(CurrentUserPrincipal principal, UUID invoiceId, CashPaymentRequest request);

    InvoiceResponse confirmCashRefund(CurrentUserPrincipal principal, UUID invoiceId, CashRefundRequest request);

    InvoiceResponse cancel(CurrentUserPrincipal principal, UUID invoiceId);

    List<PaymentTransactionResponse> getTransactions(CurrentUserPrincipal principal, UUID invoiceId);
}
