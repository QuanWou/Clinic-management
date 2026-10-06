package com.clinic.audit.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="audit_chain_heads",schema="audit_v2")
public class AuditChainHead {
    @Id @Column(name="scope_key",length=80) public String scopeKey;
    @Column(name="last_event_id") public UUID lastEventId;
    @Column(name="last_hash",length=64) public String lastHash;
    @Column(name="updated_at",nullable=false) public Instant updatedAt;
    @PrePersist @PreUpdate void touch(){updatedAt=Instant.now();}
}
