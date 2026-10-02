package com.clinic.v2.audit.service;

import com.clinic.v2.audit.domain.OutboxEvent;
import com.clinic.v2.audit.repo.OutboxEventRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
public class OutboxRelayService {
    private final OutboxEventRepository outbox;
    private final int maxAttempts;

    public OutboxRelayService(OutboxEventRepository outbox,@Value("${audit.outbox.max-attempts:5}") int maxAttempts){
        this.outbox=outbox;this.maxAttempts=Math.max(1,maxAttempts);
    }

    @Transactional
    public RelayResult relayOnce(EventPublisher publisher,int batchSize){
        List<OutboxEvent> rows=outbox.lockDue(Instant.now(),PageRequest.of(0,Math.max(1,Math.min(batchSize,100))));
        int published=0,failed=0,dead=0;
        for(OutboxEvent row:rows){
            row.attempts++;
            try{
                publisher.publish(row.eventJson);
                row.status="PUBLISHED";row.publishedAt=Instant.now();row.lastError=null;published++;
            }catch(Exception ex){
                failed++;row.lastError=truncate(ex.getMessage());
                if(row.attempts>=maxAttempts){row.status="DEAD_LETTER";dead++;}
                else row.nextAttemptAt=Instant.now().plusSeconds(Math.min(300,1L<<Math.min(row.attempts,8)));
            }
        }
        outbox.saveAll(rows);
        return new RelayResult(rows.size(),published,failed,dead);
    }

    private String truncate(String value){
        String v=value==null?"publisher failure":value;
        return v.length()<=500?v:v.substring(0,500);
    }
    public record RelayResult(int attempted,int published,int failed,int deadLettered){}
}
