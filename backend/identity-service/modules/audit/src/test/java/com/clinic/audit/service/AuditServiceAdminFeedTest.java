package com.clinic.audit.service;

import com.clinic.audit.api.AuditDto.AdminAuditView;
import com.clinic.audit.domain.AuditEvent;
import com.clinic.audit.repo.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuditServiceAdminFeedTest {
    @Test
    void adminFeedUsesAWhitelistedProjectionWithoutSensitiveAuditFields(){
        AuditEventRepository events=mock(AuditEventRepository.class);
        AuditService service=new AuditService(
            mock(AuditChainHeadRepository.class),events,mock(OutboxEventRepository.class),
            mock(SafeMetadata.class),mock(EventEnvelopeValidator.class),mock(EntityManager.class),
            new ObjectMapper()
        );
        UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),actor=UUID.randomUUID();
        AuditEvent event=new AuditEvent();
        event.id=UUID.randomUUID();event.clinicId=clinic;event.branchId=branch;event.actorUserId=actor;
        event.category="BILLING";event.action="clinic.billing.shift_approved.v1";
        event.resourceType="billing";event.resourceId=UUID.randomUUID().toString();
        event.outcome="SUCCESS";event.reason="sensitive internal reason";
        event.correlationId="corr-1";event.occurredAt=Instant.parse("2026-10-06T10:00:00Z");
        event.previousHash="previous-secret-chain";event.eventHash="current-secret-chain";
        event.metadataJson="{\"private\":\"internal\"}";
        when(events.findByClinicIdOrderByOccurredAtDescIdDesc(eq(clinic),any(Pageable.class)))
            .thenReturn(List.of(event));

        List<AdminAuditView> result=service.adminFeed(clinic,100);

        assertEquals(1,result.size());
        assertEquals(event.id,result.getFirst().id());
        assertEquals(event.action,result.getFirst().action());
        assertEquals(event.resourceId,result.getFirst().resourceId());
        Set<String> fields=Arrays.stream(AdminAuditView.class.getRecordComponents())
            .map(component->component.getName()).collect(Collectors.toSet());
        assertEquals(Set.of("id","branchId","actorUserId","category","action","resourceType","resourceId",
            "outcome","correlationId","occurredAt"),fields);
        assertFalse(fields.contains("reason"));
        assertFalse(fields.contains("metadata"));
        assertFalse(fields.contains("eventHash"));
        assertFalse(fields.contains("previousHash"));
    }

    @Test
    void adminFeedRejectsUnboundedReads(){
        AuditService service=new AuditService(
            mock(AuditChainHeadRepository.class),mock(AuditEventRepository.class),mock(OutboxEventRepository.class),
            mock(SafeMetadata.class),mock(EventEnvelopeValidator.class),mock(EntityManager.class),
            new ObjectMapper()
        );
        assertThrows(RuntimeException.class,()->service.adminFeed(UUID.randomUUID(),201));
        assertThrows(RuntimeException.class,()->service.adminFeed(UUID.randomUUID(),0));
    }
}
