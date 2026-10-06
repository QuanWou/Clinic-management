package com.clinic.billing.api;
import com.clinic.billing.security.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
@RestController public class OperationsSummaryController {
 private final JdbcTemplate jdbc;private final BillingDb db;private final IamAuthorizationClient iam;private final TransactionTemplate tx;
 public OperationsSummaryController(JdbcTemplate jdbc,BillingDb db,IamAuthorizationClient iam,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;tx=new TransactionTemplate(manager);tx.setReadOnly(true);tx.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);}
 public record Summary(LocalDate date,Instant measuredAt,long issuedVnd,long collectedCashVnd,long collectedBankVnd,long collectedPosVnd,long receiptCount,long outstandingVnd,long openShifts,long submittedShifts,long approvedShifts,long collectedOnlineVnd,long paymentReviews,long collectedSandboxVnd){}
 private long tender(String method,Timestamp start,Timestamp end){return jdbc.queryForObject("select coalesce(sum(amount_vnd),0) from billing_v2.payments where method=? and created_at>=? and created_at<?",Long.class,method,start,end);}
 private long sandbox(Timestamp start,Timestamp end){return jdbc.queryForObject("select coalesce(sum(p.amount_vnd),0) from billing_v2.payments p join billing_v2.payment_intents i on i.receipt_id=p.id where p.created_at>=? and p.created_at<? and i.checkout_url like 'https://sandbox.vnpayment.vn/%'",Long.class,start,end);}
 @GetMapping("/api/clinics/{c}/branches/{b}/operations-summary")
 public Summary read(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@RequestParam LocalDate date){
  if(actor==null)throw ApiProblem.forbidden();var decision=iam.decide(actor.id(),"BILLING",c,b);if(!decision.allowed()||decision.role()==null||!Set.of("ADMIN").contains(decision.role()))throw ApiProblem.forbidden();
  var start=Timestamp.from(date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());var end=Timestamp.from(date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
  return tx.execute(t->{db.scope(c,b);long issued=jdbc.queryForObject("select coalesce(sum(subtotal_vnd-adjustment_vnd),0) from billing_v2.bills where created_at>=? and created_at<?",Long.class,start,end),receipts=jdbc.queryForObject("select count(*) from billing_v2.payments where created_at>=? and created_at<?",Long.class,start,end),outstanding=jdbc.queryForObject("select coalesce(sum(subtotal_vnd-adjustment_vnd-paid_vnd),0) from billing_v2.bills",Long.class);
   long open=jdbc.queryForObject("select count(*) from billing_v2.shifts where state='OPEN'",Long.class),submitted=jdbc.queryForObject("select count(*) from billing_v2.shifts where state='SUBMITTED'",Long.class),approved=jdbc.queryForObject("select count(*) from billing_v2.shifts where state='APPROVED' and approved_at>=? and approved_at<?",Long.class,start,end);
   return new Summary(date,Instant.now(),issued,tender("CASH",start,end),tender("BANK_TRANSFER",start,end),tender("POS",start,end),receipts,outstanding,open,submitted,approved,tender("PAYOS",start,end)+tender("VNPAY",start,end)-sandbox(start,end),jdbc.queryForObject("select count(*) from billing_v2.payment_intents where status='REVIEW_REQUIRED'",Long.class),sandbox(start,end));});
 }
}
