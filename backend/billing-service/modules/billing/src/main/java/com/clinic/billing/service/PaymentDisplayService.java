package com.clinic.billing.service;

import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.api.BillingDto.Bill;
import com.clinic.billing.security.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;

@Service
public class PaymentDisplayService {
 private final JdbcTemplate jdbc;private final BillingDb db;private final BillingService billing;private final OnlinePaymentService online;private final PaymentConfiguration.Settings config;private final TransactionTemplate tx;
 private final SecureRandom random=new SecureRandom();
 public PaymentDisplayService(JdbcTemplate jdbc,BillingDb db,BillingService billing,OnlinePaymentService online,PaymentConfiguration.Settings config,PlatformTransactionManager manager){
  this.jdbc=jdbc;this.db=db;this.billing=billing;this.online=online;this.config=config;tx=new TransactionTemplate(manager);
 }
 public record Create(String method,long expectedVersion){}
 public record Launch(String method,String displayUrl,String checkoutUrl,Instant expiresAt,String status){}
 public record View(String method,String status,long amountVnd,String currency,Instant expiresAt,String bankName,String accountNumber,String accountName,String transferContent,String qrCode,String qrUrl,String checkoutUrl,String message){}

 private <T>T local(UUID c,UUID b,Supplier<T> work){return tx.execute(t->{db.scope(c,b);return work.get();});}
 private static long number(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
 private static String text(Map<String,Object> row,String key){return row.get(key)==null?null:row.get(key).toString();}
 private static String hash(String token){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));}catch(Exception e){throw new IllegalStateException(e);}}
 private String token(){byte[] bytes=new byte[32];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 private String displayUrl(String token){return config.publicUrl().replaceAll("/$","")+"/payment-display/"+token;}

 public Launch create(Actor actor,UUID c,UUID b,UUID billId,String key,Create input,HttpServletRequest request){
  billing.authorizeBilling(actor,c,b);
  if(input==null||!Set.of("BANK_TRANSFER","PAYOS","VNPAY").contains(input.method()))throw ApiProblem.invalid("Phương thức hiển thị thanh toán không hợp lệ.");
  Bill bill=billing.read(actor,c,b,billId);
  if(bill.remainingVnd()<=0)throw ApiProblem.conflict("Phiếu đã thanh toán đủ.");
  if(bill.version()!=input.expectedVersion())throw ApiProblem.conflict("Phiếu thu vừa thay đổi. Tải lại số tiền trước khi tạo mã thanh toán.");
  if("VNPAY".equals(input.method())){
   var intent=online.createStaff(actor,c,b,billId,key,new OnlinePaymentService.Create("VNPAY",input.expectedVersion()),request.getRemoteAddr());
   return new Launch("VNPAY",null,intent.checkoutUrl(),intent.expiresAt(),intent.status());
  }
  PaymentGateways.BankDetails bank=null;OnlinePaymentService.Intent intent=null;
  if("BANK_TRANSFER".equals(input.method()))bank=online.staffBank(c,b,billId);
  else intent=online.createStaff(actor,c,b,billId,key,new OnlinePaymentService.Create("PAYOS",input.expectedVersion()),request.getRemoteAddr());
  String raw=token(),digest=hash(raw);UUID session=UUID.randomUUID();Instant sessionExpiry=Instant.now().plus(Duration.ofHours(2));
  PaymentGateways.BankDetails finalBank=bank;OnlinePaymentService.Intent finalIntent=intent;
  local(c,b,()->{
   jdbc.update("insert into billing_v2.payment_display_sessions(id,token_hash,clinic_id,branch_id,bill_id,payment_intent_id,method,amount_vnd,bank_name,account_number,account_name,transfer_content,qr_value,created_by,expires_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    session,digest,c,b,billId,finalIntent==null?null:finalIntent.id(),input.method(),finalBank==null?finalIntent.amountVnd():finalBank.amountVnd(),
    finalBank==null?null:finalBank.bankName(),finalBank==null?null:finalBank.accountNumber(),finalBank==null?null:finalBank.accountName(),finalBank==null?null:finalBank.content(),
    finalIntent==null?finalBank.qrUrl():finalIntent.qrCode(),actor.id(),Timestamp.from(sessionExpiry));
   return null;
  });
  return new Launch(input.method(),displayUrl(raw),null,finalIntent==null?sessionExpiry:finalIntent.expiresAt(),finalIntent==null?"PENDING":finalIntent.status());
 }

 public String eventChannel(String raw){
  if(raw==null||!raw.matches("[A-Za-z0-9_-]{30,120}"))throw ApiProblem.missing();String digest=hash(raw);
  var scopes=jdbc.queryForList("select clinic_id,branch_id from billing_v2.resolve_payment_display_scope(?)",digest);if(scopes.isEmpty())throw ApiProblem.missing();
  UUID c=(UUID)scopes.getFirst().get("clinic_id"),b=(UUID)scopes.getFirst().get("branch_id");
  UUID bill=local(c,b,()->{var rows=jdbc.queryForList("select bill_id from billing_v2.payment_display_sessions where token_hash=? and expires_at>now()",UUID.class,digest);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();});
  return com.clinic.realtime.PostgresRealtime.channel("billing_display",c,b,bill);
 }
 public View read(String raw){
  if(raw==null||!raw.matches("[A-Za-z0-9_-]{30,120}"))throw ApiProblem.missing();
  String digest=hash(raw);
  var scope=jdbc.queryForList("select clinic_id,branch_id from billing_v2.resolve_payment_display_scope(?)",digest);
  if(scope.isEmpty())throw ApiProblem.missing();
  UUID c=(UUID)scope.getFirst().get("clinic_id"),b=(UUID)scope.getFirst().get("branch_id");
  var row=local(c,b,()->{
   var rows=jdbc.queryForList("select * from billing_v2.payment_display_sessions where token_hash=? and expires_at>now()",digest);
   if(rows.isEmpty())throw ApiProblem.missing();jdbc.update("update billing_v2.payment_display_sessions set last_presented_at=now() where token_hash=?",digest);return rows.getFirst();
  });
  String method=row.get("method").toString();long amount=number(row,"amount_vnd");Instant displayExpiry=((Timestamp)row.get("expires_at")).toInstant();
  if("PAYOS".equals(method)){
   UUID intentId=(UUID)row.get("payment_intent_id");OnlinePaymentService.Intent intent;
   try{intent=online.systemRead(c,b,intentId,true);}catch(RuntimeException e){intent=online.systemRead(c,b,intentId,false);}
   return new View(method,intent.status(),intent.amountVnd(),"VND",intent.expiresAt(),null,null,null,null,intent.qrCode(),null,intent.checkoutUrl(),intent.message());
  }
  var bill=local(c,b,()->jdbc.queryForMap("select subtotal_vnd,adjustment_vnd,paid_vnd,status from billing_v2.bills where id=?",row.get("bill_id")));
  long remaining=number(bill,"subtotal_vnd")-number(bill,"adjustment_vnd")-number(bill,"paid_vnd");
  String status=remaining<=0?"PAID":"PENDING";
  String message="PAID".equals(status)?"Phòng khám đã xác nhận nhận tiền.":"Đang chờ nhân viên xác nhận khoản chuyển.";
  return new View(method,status,amount,"VND",displayExpiry,text(row,"bank_name"),text(row,"account_number"),text(row,"account_name"),text(row,"transfer_content"),null,text(row,"qr_value"),null,message);
 }
}
