package com.clinic.v2.audit.repo;

import com.clinic.v2.audit.domain.OutboxEvent;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent,UUID> {
    Optional<OutboxEvent> findByEventId(UUID eventId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(value="select o from OutboxEvent o where o.status='PENDING' and o.nextAttemptAt<=:now order by o.createdAt asc")
    List<OutboxEvent> lockDue(@Param("now") Instant now, org.springframework.data.domain.Pageable page);
}
