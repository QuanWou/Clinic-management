package com.clinic.medicalrecord.service.impl;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import com.clinic.medicalrecord.client.DoctorClient;
import com.clinic.medicalrecord.client.CatalogClient;
import com.clinic.medicalrecord.client.PatientClient;
import com.clinic.medicalrecord.dto.CollectLabSampleRequest;
import com.clinic.medicalrecord.dto.CreateLabOrderRequest;
import com.clinic.medicalrecord.dto.LabOrderResponse;
import com.clinic.medicalrecord.dto.LabBillableItemResponse;
import com.clinic.medicalrecord.dto.LabBillableItemsResponse;
import com.clinic.medicalrecord.dto.RecordLabResultRequest;
import com.clinic.medicalrecord.entity.LabOrder;
import com.clinic.medicalrecord.entity.LabBillingClosure;
import com.clinic.medicalrecord.entity.LabOrderStatus;
import com.clinic.medicalrecord.entity.LabEventOutbox;
import com.clinic.medicalrecord.entity.MedicalRecord;
import com.clinic.medicalrecord.repository.LabOrderRepository;
import com.clinic.medicalrecord.repository.LabBillingClosureRepository;
import com.clinic.medicalrecord.repository.LabEventOutboxRepository;
import com.clinic.medicalrecord.repository.MedicalRecordRepository;
import com.clinic.medicalrecord.security.CurrentUserPrincipal;
import com.clinic.medicalrecord.service.LabOrderService;
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
public class LabOrderServiceImpl implements LabOrderService {
    private final LabOrderRepository labOrders;
    private final MedicalRecordRepository records;
    private final DoctorClient doctors;
    private final PatientClient patients;
    private final MedicalAuditService audit;
    private final LabEventOutboxRepository outbox;
    private final LabBillingClosureRepository billingClosures;
    private final CatalogClient catalog;

    @Override
    @Transactional
    public LabOrderResponse create(CurrentUserPrincipal principal, String authorization, UUID recordId, CreateLabOrderRequest request) {
        MedicalRecord record = findRecord(recordId);
        requireTreatingDoctor(principal, authorization, record);
        if (request.serviceId() == null || request.performedOn() == null
                || request.performedOn().isAfter(java.time.LocalDate.now())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Lab order requires a catalog service and a non-future performed date");
        }
        CatalogClient.CatalogService catalogService = catalog.requireActiveService(
                authorization, request.serviceId(), request.testCode().trim());
        ensureBillingOpen(record.getAppointmentId());
        LabOrder order = LabOrder.builder()
                .medicalRecord(record)
                .testCode(catalogService.code())
                .testName(catalogService.name())
                .serviceId(catalogService.id())
                .performedOn(request.performedOn())
                .status(LabOrderStatus.ORDERED)
                .build();
        LabOrder saved = labOrders.save(order);
        audit.recordMutation(principal.id(), "LAB_ORDER_CREATED", saved.getId());
        log.info("Lab order {} created for medical record {}", saved.getId(), recordId);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LabOrderResponse> list(CurrentUserPrincipal principal, String authorization, UUID recordId) {
        MedicalRecord record = findRecord(recordId);
        boolean isDoctor = isTreatingDoctor(principal, authorization, record);
        if (!isDoctor && !isOwningPatient(principal, authorization, record)) {
            throw forbidden();
        }
        return labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(recordId).stream()
                .filter(order -> isDoctor || order.getStatus() == LabOrderStatus.RELEASED)
                .map(order -> {
                    audit.recordRead(principal.id(), "LAB_ORDER_READ", order.getId());
                    return toResponse(order);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isBillingFinalized(CurrentUserPrincipal principal, String authorization, UUID recordId) {
        MedicalRecord record = findRecord(recordId);
        requireTreatingDoctor(principal, authorization, record);
        return billingClosures.findById(record.getAppointmentId())
                .map(LabBillingClosure::isFinalized).orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public LabOrderResponse get(CurrentUserPrincipal principal, String authorization, UUID orderId) {
        LabOrder order = findOrder(orderId);
        if (!isTreatingDoctor(principal, authorization, order.getMedicalRecord())
                && !(order.getStatus() == LabOrderStatus.RELEASED
                && isOwningPatient(principal, authorization, order.getMedicalRecord()))) {
            throw forbidden();
        }
        audit.recordRead(principal.id(), "LAB_ORDER_READ", orderId);
        return toResponse(order);
    }

    @Override
    @Transactional
    public LabOrderResponse collect(CurrentUserPrincipal principal, String authorization, UUID orderId, CollectLabSampleRequest request) {
        LabOrder order = authorizedOrder(principal, authorization, orderId);
        requireStatus(order, LabOrderStatus.ORDERED);
        String sampleId = request.sampleIdentifier().trim();
        if (labOrders.existsBySampleIdentifier(sampleId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sample identifier already exists");
        }
        order.setSampleIdentifier(sampleId);
        order.setCollectedAt(LocalDateTime.now());
        order.setStatus(LabOrderStatus.COLLECTED);
        return saveTransition(principal, order, "LAB_SAMPLE_COLLECTED");
    }

    @Override
    @Transactional
    public LabOrderResponse startProcessing(CurrentUserPrincipal principal, String authorization, UUID orderId) {
        LabOrder order = authorizedOrder(principal, authorization, orderId);
        requireStatus(order, LabOrderStatus.COLLECTED);
        order.setStatus(LabOrderStatus.PROCESSING);
        return saveTransition(principal, order, "LAB_SAMPLE_PROCESSING");
    }

    @Override
    @Transactional
    public LabOrderResponse recordResult(CurrentUserPrincipal principal, String authorization, UUID orderId, RecordLabResultRequest request) {
        LabOrder order = authorizedOrder(principal, authorization, orderId);
        requireStatus(order, LabOrderStatus.PROCESSING);
        order.setResultValue(request.value().trim());
        order.setResultUnit(request.unit() == null ? null : request.unit().trim());
        order.setReferenceRange(request.referenceRange() == null ? null : request.referenceRange().trim());
        order.setResultedAt(LocalDateTime.now());
        order.setStatus(LabOrderStatus.RESULTED);
        return saveTransition(principal, order, "LAB_RESULT_RECORDED");
    }

    @Override
    @Transactional
    public LabOrderResponse release(CurrentUserPrincipal principal, String authorization, UUID orderId) {
        LabOrder order = authorizedOrder(principal, authorization, orderId);
        requireStatus(order, LabOrderStatus.RESULTED);
        order.setReleasedAt(LocalDateTime.now());
        order.setStatus(LabOrderStatus.RELEASED);
        LabOrderResponse released = saveTransition(principal, order, "LAB_RESULT_RELEASED");
        MedicalRecord record = order.getMedicalRecord();
        // The result, audit and durable intent share a transaction. Recipient lookup happens
        // later in the relay: a walk-in patient or unavailable directory must not block release.
        outbox.save(new LabEventOutbox(order.getId(), record.getAppointmentId(),
                record.getPatientId(), null, order.getReleasedAt()));
        return released;
    }

    @Override
    @Transactional(readOnly = true)
    public LabBillableItemsResponse billableItems(CurrentUserPrincipal principal, UUID appointmentId) {
        requireBillingStaff(principal);
        LabBillingClosure closure = billingClosures.findById(appointmentId)
                .orElseGet(() -> LabBillingClosure.builder().appointmentId(appointmentId).finalized(false).build());
        return billableItemsResponse(principal, appointmentId, closure);
    }

    @Override
    @Transactional
    public LabBillableItemsResponse finalizeBilling(CurrentUserPrincipal principal, UUID appointmentId) {
        requireBillingStaff(principal);
        MedicalRecord record = records.findByAppointmentId(appointmentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
        LabBillingClosure closure = getOrCreateClosureForUpdate(appointmentId);
        if (closure.isFinalized()) {
            return billableItemsResponse(principal, appointmentId, closure);
        }
        List<LabOrder> orders = labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId());
        boolean invalid = orders.stream().anyMatch(order -> order.getStatus() != LabOrderStatus.RELEASED
                || order.getServiceId() == null || order.getPerformedOn() == null);
        if (invalid) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "All lab orders must be released and linked to catalog services before billing finalization");
        }
        closure.setFinalized(true);
        closure.setRevision(UUID.randomUUID().toString());
        closure.setFinalizedAt(LocalDateTime.now());
        billingClosures.saveAndFlush(closure);
        return billableItemsResponse(principal, appointmentId, closure);
    }

    private LabBillableItemsResponse billableItemsResponse(CurrentUserPrincipal principal, UUID appointmentId,
                                                            LabBillingClosure closure) {
        return records.findByAppointmentId(appointmentId)
                .map(record -> new LabBillableItemsResponse(appointmentId,
                        labOrders.findByMedicalRecordIdOrderByCreatedAtDesc(record.getId()).stream()
                                .map(order -> {
                                    audit.recordRead(principal.id(), "LAB_BILLING_METADATA_READ", order.getId());
                                    return new LabBillableItemResponse(order.getId(), order.getTestCode(), 1,
                                            order.getStatus(), order.getStatus() == LabOrderStatus.RELEASED
                                            ? order.getReleasedAt() : null, order.getServiceId(), order.getPerformedOn());
                                }).toList(), closure.isFinalized(), closure.getRevision()))
                .orElseGet(() -> new LabBillableItemsResponse(appointmentId, List.of(),
                        closure.isFinalized(), closure.getRevision()));
    }

    private LabOrderResponse saveTransition(CurrentUserPrincipal principal, LabOrder order, String action) {
        LabOrder saved = labOrders.saveAndFlush(order);
        audit.recordMutation(principal.id(), action, saved.getId());
        log.info("Lab order {} transition {}", saved.getId(), action);
        return toResponse(saved);
    }

    private LabOrder authorizedOrder(CurrentUserPrincipal principal, String authorization, UUID orderId) {
        LabOrder order = findOrder(orderId);
        requireTreatingDoctor(principal, authorization, order.getMedicalRecord());
        ensureBillingOpen(order.getMedicalRecord().getAppointmentId());
        return order;
    }

    private void ensureBillingOpen(UUID appointmentId) {
        if (getOrCreateClosureForUpdate(appointmentId).isFinalized()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Lab billing items are already finalized");
        }
    }

    private LabBillingClosure getOrCreateClosureForUpdate(UUID appointmentId) {
        return billingClosures.findByAppointmentIdForUpdate(appointmentId).orElseGet(() -> {
            LabBillingClosure created = LabBillingClosure.builder()
                    .appointmentId(appointmentId).finalized(false).build();
            billingClosures.save(created);
            return created;
        });
    }

    private void requireBillingStaff(CurrentUserPrincipal principal) {
        if (!principal.hasRole("ADMIN") && !principal.hasRole("RECEPTIONIST")) {
            throw forbidden();
        }
    }

    private MedicalRecord findRecord(UUID id) {
        return records.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Medical record not found"));
    }

    private LabOrder findOrder(UUID id) {
        return labOrders.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Lab order not found"));
    }

    private void requireTreatingDoctor(CurrentUserPrincipal principal, String authorization, MedicalRecord record) {
        if (!isTreatingDoctor(principal, authorization, record)) {
            throw forbidden();
        }
    }

    private boolean isTreatingDoctor(CurrentUserPrincipal principal, String authorization, MedicalRecord record) {
        return principal.hasRole("DOCTOR")
                && record.getDoctorId().equals(doctors.getCurrentDoctorProfile(authorization).id());
    }

    private boolean isOwningPatient(CurrentUserPrincipal principal, String authorization, MedicalRecord record) {
        return principal.hasRole("PATIENT")
                && record.getPatientId().equals(patients.getCurrentPatientProfile(authorization).id());
    }

    private BusinessException forbidden() {
        return new BusinessException(ErrorCode.FORBIDDEN, "Not authorized to access this clinical information");
    }

    private void requireStatus(LabOrder order, LabOrderStatus expected) {
        if (order.getStatus() != expected) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Lab order must be in " + expected + " state for this operation");
        }
    }

    private LabOrderResponse toResponse(LabOrder order) {
        return new LabOrderResponse(
                order.getId(), order.getMedicalRecord().getId(), order.getTestCode(), order.getTestName(),
                order.getServiceId(), order.getPerformedOn(),
                order.getStatus(), order.getSampleIdentifier(), order.getCollectedAt(), order.getResultValue(),
                order.getResultUnit(), order.getReferenceRange(), order.getResultedAt(), order.getReleasedAt(),
                order.getCreatedAt(), order.getUpdatedAt());
    }
}
