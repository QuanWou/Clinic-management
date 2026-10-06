package com.clinic.iam.security;
import com.clinic.iam.domain.UserSecurityState;
import com.clinic.iam.repo.UserSecurityStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;
@Service
public class SessionSecurityService {
 private final DatabaseScope scope; private final UserSecurityStateRepository states;
 public SessionSecurityService(DatabaseScope scope,UserSecurityStateRepository states){this.scope=scope;this.states=states;}
 @Transactional(readOnly=true)
 public boolean accessAllowed(Actor actor){
  scope.user(actor.id());
  return states.findById(actor.id()).map(s->s.invalidBefore==null||actor.issuedAt().isAfter(s.invalidBefore)).orElse(true);
 }
 @Transactional
 public long revokeBefore(UUID userId,Instant instant){
  scope.user(userId);
  UserSecurityState s=states.findById(userId).orElseGet(()->{var x=new UserSecurityState();x.userId=userId;return x;});
  if(s.invalidBefore==null||instant.isAfter(s.invalidBefore))s.invalidBefore=instant;
  states.saveAndFlush(s);return s.version;
 }
}
