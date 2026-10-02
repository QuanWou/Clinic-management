package com.clinic.v2.audit.repo;

import com.clinic.v2.audit.domain.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AuditEventRepository extends JpaRepository<AuditEvent,UUID> {
    List<AuditEvent> findByCorrelationIdOrderByOccurredAtAscIdAsc(String correlationId);
    List<AuditEvent> findByScopeKeyOrderByCreatedAtAscIdAsc(String scopeKey);
}
