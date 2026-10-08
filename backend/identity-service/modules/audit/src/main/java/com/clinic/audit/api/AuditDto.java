package com.clinic.audit.api;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class AuditDto {
    private AuditDto(){}

    public record AuditInput(
        UUID clinicId,
        UUID branchId,
        @NotNull UUID actorUserId,
        UUID delegatedActorId,
        @NotBlank @Pattern(regexp="^(AUTH|MEMBERSHIP|CLINIC_ADMIN|CLINICAL|BILLING|SECURITY|SYSTEM)$") String category,
        @NotBlank @Size(max=100) String action,
        @NotBlank @Size(max=80) String resourceType,
        @NotBlank @Size(max=160) String resourceId,
        @NotBlank @Pattern(regexp="^(SUCCESS|DENIED|FAILED|PENDING)$") String outcome,
        @Size(max=500) String reason,
        @NotBlank @Size(max=128) String correlationId,
        @NotNull Instant occurredAt,
        Map<String,Object> metadata
    ){}

    public record AuditView(UUID id,UUID clinicId,UUID branchId,UUID actorUserId,UUID delegatedActorId,
        String category,String action,String resourceType,String resourceId,String outcome,String reason,
        String correlationId,Instant occurredAt,String previousHash,String eventHash,Map<String,Object> metadata){}

    public record AdminAuditView(UUID id,UUID branchId,UUID actorUserId,String category,String action,
        String resourceType,String resourceId,String outcome,String correlationId,Instant occurredAt){}

    public record ChainVerification(String scopeKey,int events,boolean valid,String lastHash){}

    public record EventEnvelopeInput(
        @NotBlank String specversion,
        @NotNull UUID id,
        @NotBlank String source,
        @NotBlank String type,
        @NotBlank String subject,
        @NotNull Instant time,
        @NotBlank String datacontenttype,
        @NotNull UUID clinicid,
        UUID branchid,
        @NotBlank @Size(max=128) String correlationid,
        @Size(max=128) String causationid,
        @Min(1) long aggregateversion,
        @NotNull Map<String,Object> data
    ){}

    public record EnvelopeValidation(boolean valid,String message){}
}
