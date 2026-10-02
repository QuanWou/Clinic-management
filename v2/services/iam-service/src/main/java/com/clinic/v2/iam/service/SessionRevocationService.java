package com.clinic.v2.iam.service;

import com.clinic.v2.iam.domain.UserSessionState;
import com.clinic.v2.iam.repo.*;
import com.clinic.v2.iam.security.IamDbContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

@Service
public class SessionRevocationService {
    private final UserSessionStateRepository states;
    private final PermissionEpochRepository epochs;
    private final IamDbContext db;

    public SessionRevocationService(UserSessionStateRepository states,PermissionEpochRepository epochs,IamDbContext db){
        this.states=states;this.epochs=epochs;this.db=db;
    }

    @Transactional(readOnly=true)
    public boolean allowed(UUID userId,Instant tokenIssuedAt){
        if(userId==null || tokenIssuedAt==null) return false;
        db.self(userId);
        return states.findById(userId).map(s->s.invalidBefore==null || tokenIssuedAt.isAfter(s.invalidBefore)).orElse(true);
    }

    @Transactional
    public long revokeAllBeforeNow(UUID userId){
        db.self(userId);
        UserSessionState s=states.lockByUserId(userId).orElse(null);
        if(s==null){s=new UserSessionState();s.userId=userId;s.version=1;}
        else s.version++;
        s.invalidBefore=Instant.now();
        states.saveAndFlush(s);

        var e=epochs.lockByUserId(userId).orElse(null);
        if(e==null){e=new com.clinic.v2.iam.domain.PermissionEpoch();e.userId=userId;e.epoch=1;}
        else e.epoch++;
        epochs.saveAndFlush(e);
        return s.version;
    }
}
