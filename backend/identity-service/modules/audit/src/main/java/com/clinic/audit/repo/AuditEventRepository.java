package com.clinic.audit.repo;

import com.clinic.audit.domain.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AuditEventRepository extends JpaRepository<AuditEvent,UUID> {
    List<AuditEvent> findByCorrelationIdOrderByOccurredAtAscIdAsc(String correlationId);
    List<AuditEvent> findByScopeKeyOrderByCreatedAtAscIdAsc(String scopeKey);
}
