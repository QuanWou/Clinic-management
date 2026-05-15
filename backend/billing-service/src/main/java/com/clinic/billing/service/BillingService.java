package com.clinic.billing.service;

import com.clinic.billing.dto.CreateInvoiceRequest;
import com.clinic.billing.dto.InvoiceResponse;
import com.clinic.billing.dto.PayInvoiceRequest;
import com.clinic.billing.security.CurrentUserPrincipal;

import java.util.List;
import java.util.UUID;

public interface BillingService {

    InvoiceResponse create(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, CreateInvoiceRequest request);

    InvoiceResponse getById(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID invoiceId);

    InvoiceResponse getByAppointmentId(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID appointmentId);

    List<InvoiceResponse> getMyInvoices(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal);

    List<InvoiceResponse> getByPatientId(UUID currentUserId, CurrentUserPrincipal principal, UUID patientId);

    InvoiceResponse pay(UUID currentUserId, String authorizationHeader, CurrentUserPrincipal principal, UUID invoiceId, PayInvoiceRequest request);
}
