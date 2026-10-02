package com.clinic.v2.encounter.api;
import com.clinic.v2.encounter.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
@RestController public class OperationsSummaryController {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final IamAuthorizationClient iam;private final TransactionTemplate tx;
 public OperationsSummaryController(JdbcTemplate jdbc,EncounterDb db,IamAuthorizationClient iam,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;tx=new TransactionTemplate(manager);tx.setReadOnly(true);tx.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);}
 public record Summary(LocalDate date,Instant measuredAt,long checkedIn,long completed,long openVisits,long overnight,long awaitingResults,long arrivalPending,long waitingTickets,long servingTickets){}
 private long count(String where,Object... args){return jdbc.queryForObject("select count(*) from encounter_v2.visits where "+where,Long.class,args);}
 @GetMapping("/api/v2/clinics/{c}/branches/{b}/operations-summary")
 public Summary read(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@RequestParam LocalDate date){
  if(actor==null)throw ApiProblem.forbidden();var decision=iam.decide(actor.id(),"RECEPTION",c,b);if(!decision.allowed()||decision.role()==null||!Set.of("CLINIC_OWNER","CLINIC_MANAGER").contains(decision.role()))throw ApiProblem.forbidden();
  var start=Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());var end=Timestamp.from(date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
  return tx.execute(t->{db.scope(c,b);long check=count("checked_in_at>=? and checked_in_at<?",start,end),complete=count("clinically_completed_at>=? and clinically_completed_at<?",start,end),open=count("status not in ('CLOSED','CANCELLED')"),overnight=count("status not in ('CLOSED','CANCELLED') and created_at<?",Timestamp.from(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant())),waiting=count("status='AWAITING_RESULTS'"),pending=count("status='ARRIVAL_PENDING'");
   long queue=jdbc.queryForObject("select count(*) from encounter_v2.queue_tickets where queue_date=? and state in ('WAITING','CALLED')",Long.class,date),serving=jdbc.queryForObject("select count(*) from encounter_v2.queue_tickets where queue_date=? and state='SERVING'",Long.class,date);
   return new Summary(date,Instant.now(),check,complete,open,overnight,waiting,pending,queue,serving);});
 }
}
