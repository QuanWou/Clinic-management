package com.clinic.appointment.service;

import com.clinic.appointment.dto.AddPerformedServiceRequest;
import com.clinic.appointment.dto.PerformedServicesResponse;
import com.clinic.appointment.client.DoctorClient;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PerformedServicesService {
    private final AppointmentRepository appointments;
    private final PerformedServiceRepository performedServices;
    private final AppointmentBillingClosureRepository closures;
    private final DoctorClient doctors;

    @Transactional
    public PerformedServicesResponse add(CurrentUserPrincipal principal, String authorization, UUID appointmentId,
                                         AddPerformedServiceRequest request) {
        Appointment appointment = lockAppointment(appointmentId);
        requireAppointmentStaff(principal, authorization, appointment);
        AppointmentBillingClosure closure = openClosure(appointmentId);
        if (closure.isFinalized()) {
            throw conflict("Performed services are already finalized for billing");
        }
        if (appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw conflict("Cannot record services for a cancelled appointment");
        }
        if (!appointment.getAppointmentDate().equals(request.serviceDate())
                || request.serviceDate().isAfter(java.time.LocalDate.now())) {
            throw conflict("Service date must match the non-future appointment date");
        }
        performedServices.save(PerformedService.builder()
                .appointmentId(appointmentId)
                .serviceId(request.serviceId())
                .quantity(request.quantity())
                .serviceDate(request.serviceDate())
                .build());
        return response(appointmentId, closure);
    }

    @Transactional
    public PerformedServicesResponse remove(CurrentUserPrincipal principal, String authorization,
                                             UUID appointmentId, UUID itemId) {
        Appointment appointment = lockAppointment(appointmentId);
        requireAppointmentStaff(principal, authorization, appointment);
        AppointmentBillingClosure closure = openClosure(appointmentId);
        if (closure.isFinalized()) {
            throw conflict("Performed services are already finalized for billing");
        }
        PerformedService item = performedServices.findById(itemId)
                .filter(candidate -> appointmentId.equals(candidate.getAppointmentId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND,
                        "Performed service not found"));
        performedServices.delete(item);
        return response(appointmentId, closure);
    }

    @Transactional
    public PerformedServicesResponse finalizeForBilling(CurrentUserPrincipal principal, String authorization,
                                                         UUID appointmentId) {
        Appointment appointment = lockAppointment(appointmentId);
        requireAppointmentStaff(principal, authorization, appointment);
        AppointmentBillingClosure closure = openClosure(appointmentId);
        if (closure.isFinalized()) {
            return response(appointmentId, closure);
        }
        if (appointment.getStatus() != AppointmentStatus.COMPLETED) {
            throw conflict("Appointment must be completed before services are finalized");
        }
        if (performedServices.findByAppointmentIdOrderByCreatedAtAsc(appointmentId).isEmpty()) {
            throw conflict("At least one performed service is required before finalization");
        }
        closure.setFinalized(true);
        closure.setRevision(UUID.randomUUID().toString());
        closure.setFinalizedAt(LocalDateTime.now());
        closures.saveAndFlush(closure);
        return response(appointmentId, closure);
    }

    @Transactional(readOnly = true)
    public PerformedServicesResponse get(CurrentUserPrincipal principal, UUID appointmentId) {
        requireBillingStaff(principal);
        if (!appointments.existsById(appointmentId)) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found");
        }
        AppointmentBillingClosure closure = closures.findById(appointmentId)
                .orElseGet(() -> AppointmentBillingClosure.builder()
                        .appointmentId(appointmentId).finalized(false).build());
        return response(appointmentId, closure);
    }

    private Appointment lockAppointment(UUID appointmentId) {
        return appointments.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found"));
    }

    private AppointmentBillingClosure openClosure(UUID appointmentId) {
        return closures.findByAppointmentIdForUpdate(appointmentId).orElseGet(() -> {
            AppointmentBillingClosure created = AppointmentBillingClosure.builder()
                    .appointmentId(appointmentId).finalized(false).build();
            closures.save(created);
            return created;
        });
    }

    private PerformedServicesResponse response(UUID appointmentId, AppointmentBillingClosure closure) {
        return new PerformedServicesResponse(appointmentId, closure.isFinalized(), closure.getRevision(),
                performedServices.findByAppointmentIdOrderByCreatedAtAsc(appointmentId).stream()
                        .map(item -> new com.clinic.appointment.dto.PerformedServiceItemResponse(
                                item.getId(), item.getServiceId(), item.getQuantity(), item.getServiceDate()))
                        .toList());
    }

    private void requireAppointmentStaff(CurrentUserPrincipal principal, String authorization,
                                         Appointment appointment) {
        if (principal.hasRole("ADMIN") || principal.hasRole("RECEPTIONIST")) {
            return;
        }
        if (principal.hasRole("DOCTOR")
                && appointment.getDoctorId().equals(doctors.getCurrentDoctorProfile(authorization).id())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Clinical staff role required");
    }

    private void requireBillingStaff(CurrentUserPrincipal principal) {
        if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Billing staff role required");
        }
    }

    private BusinessException conflict(String message) {
        return new BusinessException(ErrorCode.CONFLICT, message);
    }
}
