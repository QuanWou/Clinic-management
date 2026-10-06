package com.clinic.audit.service;

import com.clinic.audit.api.*;
import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.domain.*;
import com.clinic.audit.repo.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class AuditService {
    private final AuditChainHeadRepository heads;
    private final AuditEventRepository events;
    private final OutboxEventRepository outbox;
    private final SafeMetadata safe;
    private final EventEnvelopeValidator envelopes;
    private final EntityManager em;
    private final ObjectMapper mapper;

    public AuditService(AuditChainHeadRepository heads,AuditEventRepository events,OutboxEventRepository outbox,
            SafeMetadata safe,EventEnvelopeValidator envelopes,EntityManager em,ObjectMapper mapper){
        this.heads=heads;this.events=events;this.outbox=outbox;this.safe=safe;this.envelopes=envelopes;this.em=em;
        this.mapper=mapper.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    }

    @Transactional
    public AuditView append(AuditInput input){
        validate(input);
        Map<String,Object> metadata=input.metadata()==null?Map.of():input.metadata();
        safe.validate(metadata);
        String scope=scope(input.clinicId());

        em.createNativeQuery("insert into audit_v2.audit_chain_heads(scope_key,updated_at) values (:scope,now()) on conflict (scope_key) do nothing")
            .setParameter("scope",scope).executeUpdate();
        AuditChainHead head=heads.lockByScope(scope).orElseThrow();

        AuditEvent event=new AuditEvent();
        event.id=UUID.randomUUID();event.scopeKey=scope;event.clinicId=input.clinicId();event.branchId=input.branchId();
        event.actorUserId=input.actorUserId();event.delegatedActorId=input.delegatedActorId();
        event.category=input.category();event.action=input.action().trim();event.resourceType=input.resourceType().trim();
        event.resourceId=input.resourceId().trim();event.outcome=input.outcome();event.reason=trim(input.reason());
        event.correlationId=input.correlationId().trim();event.occurredAt=input.occurredAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        event.previousHash=head.lastHash;event.metadataJson=json(metadata);
        event.eventHash=hash(event);
        events.saveAndFlush(event);

        head.lastEventId=event.id;head.lastHash=event.eventHash;heads.save(head);

        if(event.clinicId!=null) enqueueAuditRecorded(event);
        return view(event);
    }

    @Transactional(readOnly=true)
    public List<AuditView> trace(String correlationId){
        if(correlationId==null||correlationId.isBlank()||correlationId.length()>128)
            throw ApiProblem.invalid("Invalid correlation id");
        return events.findByCorrelationIdOrderByOccurredAtAscIdAsc(correlationId.trim()).stream().map(this::view).toList();
    }

    @Transactional(readOnly=true)
    public ChainVerification verify(UUID clinicId){
        String scope=scope(clinicId);
        List<AuditEvent> rows=events.findByScopeKeyOrderByCreatedAtAscIdAsc(scope);
        String previous=null;
        for(AuditEvent e:rows){
            if(!Objects.equals(previous,e.previousHash))return new ChainVerification(scope,rows.size(),false,previous);
            String expected=hash(e);
            if(!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),e.eventHash.getBytes(StandardCharsets.US_ASCII)))
                return new ChainVerification(scope,rows.size(),false,previous);
            previous=e.eventHash;
        }
        AuditChainHead head=heads.findById(scope).orElse(null);
        boolean headMatches=head==null?rows.isEmpty():Objects.equals(previous,head.lastHash);
        return new ChainVerification(scope,rows.size(),headMatches,previous);
    }

    private void enqueueAuditRecorded(AuditEvent e){
        EventEnvelopeInput envelope=new EventEnvelopeInput(
            "1.0",UUID.randomUUID(),"/services/audit","clinic.audit.recorded.v1","audit/"+e.id,
            Instant.now(),"application/json",e.clinicId,e.branchId,e.correlationId,null,1,
            Map.of("auditEventId",e.id.toString(),"category",e.category,"action",e.action,
                "resourceType",e.resourceType,"outcome",e.outcome)
        );
        envelopes.validate(envelope);
        OutboxEvent row=new OutboxEvent();
        row.eventId=envelope.id();row.eventJson=json(envelope);
        outbox.save(row);
    }

    private void validate(AuditInput i){
        if(i.branchId()!=null&&i.clinicId()==null)throw ApiProblem.invalid("branchId requires clinicId");
        if(("DENIED".equals(i.outcome())||"FAILED".equals(i.outcome()))&&(i.reason()==null||i.reason().isBlank()))
            throw ApiProblem.invalid("DENIED/FAILED audit events require a reason");
        Instant now=Instant.now();
        if(i.occurredAt().isAfter(now.plusSeconds(300)))
            throw ApiProblem.invalid("Audit timestamp is too far in the future");
    }

    private String scope(UUID clinicId){return clinicId==null?"platform":"clinic:"+clinicId;}
    private String trim(String v){return v==null?null:v.trim();}
    private String json(Object value){
        try{return mapper.writeValueAsString(value);}
        catch(JsonProcessingException ex){throw ApiProblem.invalid("Metadata/event cannot be serialized");}
    }
    private String hash(AuditEvent e){
        String canonical=String.join("|",
            nullSafe(e.previousHash),e.id.toString(),nullSafe(e.clinicId),nullSafe(e.branchId),
            e.actorUserId.toString(),nullSafe(e.delegatedActorId),e.category,e.action,e.resourceType,e.resourceId,
            e.outcome,nullSafe(e.reason),e.correlationId,e.occurredAt.toString(),e.metadataJson);
        try{
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        }catch(NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}
    }
    private String nullSafe(Object v){return v==null?"":String.valueOf(v);}

    @SuppressWarnings("unchecked")
    private AuditView view(AuditEvent e){
        Map<String,Object> metadata;
        try{metadata=mapper.readValue(e.metadataJson,Map.class);}
        catch(JsonProcessingException ex){metadata=Map.of("decodeError",true);}
        return new AuditView(e.id,e.clinicId,e.branchId,e.actorUserId,e.delegatedActorId,e.category,e.action,
            e.resourceType,e.resourceId,e.outcome,e.reason,e.correlationId,e.occurredAt,e.previousHash,e.eventHash,metadata);
    }
}
