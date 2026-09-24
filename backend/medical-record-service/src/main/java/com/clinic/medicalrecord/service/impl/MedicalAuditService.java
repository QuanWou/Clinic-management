package com.clinic.medicalrecord.service.impl;

import com.clinic.medicalrecord.entity.MedicalAuditEvent;
import com.clinic.medicalrecord.repository.MedicalAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MedicalAuditService {
    private final MedicalAuditRepository repository;

    /** Mutation audit must commit (or roll back) in the same transaction as the medical change. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordMutation(UUID actorUserId, String action, UUID resourceId) {
        repository.save(new MedicalAuditEvent(actorUserId, action, resourceId));
    }

    /** Read events are persisted independently of their read-only caller. Fail closed on audit failure. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRead(UUID actorUserId, String action, UUID resourceId) {
        repository.save(new MedicalAuditEvent(actorUserId, action, resourceId));
    }
}