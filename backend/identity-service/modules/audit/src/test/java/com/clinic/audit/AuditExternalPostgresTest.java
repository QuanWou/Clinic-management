package com.clinic.audit;

import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.domain.OutboxEvent;
import com.clinic.audit.repo.OutboxEventRepository;
import com.clinic.audit.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named="audit.it.enabled",matches="true")
@SpringBootTest(properties={
    "audit.security.identity-secret=synthetic-audit-identity-secret-more-than-32-bytes",
    "audit.security.clinic-secret=synthetic-audit-clinic-secret-more-than-32-bytes",
    "audit.security.doctor-secret=synthetic-audit-doctor-secret-more-than-32-bytes",
    "audit.security.catalog-secret=synthetic-audit-catalog-secret-more-than-32-bytes",
    "audit.outbox.max-attempts=3"
})
class AuditExternalPostgresTest {
    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry){
        String url=System.getProperty("audit.it.jdbc-url","");
        if(!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/clinic_v2_s005_audit_sandbox"))
            throw new IllegalStateException("S0-05 Audit test refuses non-disposable DB: "+url);
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->System.getProperty("audit.it.runtime-user"));
        registry.add("spring.datasource.password",()->System.getProperty("audit.it.runtime-password"));
        registry.add("spring.flyway.enabled",()->"false");
    }

    @Autowired AuditService audit;
    @Autowired OutboxRelayService relay;
    @Autowired OutboxEventRepository outbox;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach void isolatePendingRelayRows(){
        jdbc.update("update audit_v2.outbox_events set status='PUBLISHED', published_at=now() where status='PENDING'");
    }

    private AuditInput input(UUID clinic,String correlation,String action,String outcome,String reason){
        return new AuditInput(clinic,UUID.randomUUID(),UUID.randomUUID(),null,"CLINIC_ADMIN",action,
            "clinic",clinic.toString(),outcome,reason,correlation,Instant.now(),
            Map.of("state","SYNTHETIC","version",1));
    }

    @Test void appendOnlyHashChainAndTraceAreVerifiable(){
        UUID clinic=UUID.randomUUID();
        String trace=UUID.randomUUID().toString();

        AuditView one=audit.append(input(clinic,trace,"clinic.updated","SUCCESS",null));
        AuditView two=audit.append(input(clinic,trace,"price.changed","SUCCESS","synthetic reason"));

        assertNull(one.previousHash());
        assertEquals(one.eventHash(),two.previousHash());
        assertTrue(audit.verify(clinic).valid());
        assertEquals(2,audit.trace(trace).size());

        assertThrows(DataAccessException.class,()->
            jdbc.update("update audit_v2.audit_events set reason='tampered' where id=?",one.id()));
        assertThrows(DataAccessException.class,()->
            jdbc.update("delete from audit_v2.audit_events where id=?",one.id()));
        assertTrue(audit.verify(clinic).valid());
    }

    @Test void outboxFailurePersistsAndRetryPublishesAtLeastOnce(){
        UUID clinic=UUID.randomUUID();
        AuditView e=audit.append(input(clinic,UUID.randomUUID().toString(),"membership.revoked","SUCCESS","synthetic"));
        OutboxEvent row=outbox.findAll().stream().max(Comparator.comparing(x->x.createdAt)).orElseThrow();

        AtomicInteger failedCalls=new AtomicInteger();
        var first=relay.relayOnce(payload->{failedCalls.incrementAndGet();throw new IllegalStateException("synthetic broker outage");},10);
        assertEquals(1,failedCalls.get());
        assertEquals(1,first.failed());

        row=outbox.findById(row.id).orElseThrow();
        assertEquals("PENDING",row.status);
        assertEquals(1,row.attempts);
        assertNotNull(row.lastError);

        row.nextAttemptAt=Instant.now().minusSeconds(1);
        outbox.saveAndFlush(row);

        AtomicInteger publishedCalls=new AtomicInteger();
        var second=relay.relayOnce(payload->publishedCalls.incrementAndGet(),10);
        assertEquals(1,publishedCalls.get());
        assertEquals(1,second.published());

        row=outbox.findById(row.id).orElseThrow();
        assertEquals("PUBLISHED",row.status);
        assertEquals(2,row.attempts);
        assertNotNull(row.publishedAt);
        assertTrue(audit.verify(clinic).valid());
    }

    @Test void failedAuditRequiresReasonAndBranchRequiresClinic(){
        assertThrows(RuntimeException.class,()->audit.append(new AuditInput(
            UUID.randomUUID(),null,UUID.randomUUID(),null,"SECURITY","access.denied",
            "resource","synthetic","DENIED",null,UUID.randomUUID().toString(),Instant.now(),Map.of())));
        assertThrows(RuntimeException.class,()->audit.append(new AuditInput(
            null,UUID.randomUUID(),UUID.randomUUID(),null,"SYSTEM","bad.scope",
            "resource","synthetic","SUCCESS",null,UUID.randomUUID().toString(),Instant.now(),Map.of())));
    }
}
