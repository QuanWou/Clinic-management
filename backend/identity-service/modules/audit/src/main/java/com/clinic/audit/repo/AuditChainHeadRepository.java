package com.clinic.audit.repo;

import com.clinic.audit.domain.AuditChainHead;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface AuditChainHeadRepository extends JpaRepository<AuditChainHead,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from AuditChainHead h where h.scopeKey=:scope")
    Optional<AuditChainHead> lockByScope(@Param("scope") String scope);
}
