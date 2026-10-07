package com.clinic.billing.service;

import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.security.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

@Service
public class OnlinePaymentService {
 private final JdbcTemplate jdbc;private final BillingDb db;private final PatientBillingIdentity patient;private final PaymentGateways gateways;private final ObjectMapper json;private final TransactionTemplate tx;
 public OnlinePaymentService(JdbcTemplate jdbc,BillingDb db,PatientBillingIdentity patient,PaymentGateways gateways,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.patient=patient;this.gateways=gateways;this.json=json;tx=new TransactionTemplate(manager);}
 public record Intent(UUID id,UUID billId,String provider,String status,long amountVnd,String currency,String checkoutUrl,String qrCode,Instant expiresAt,UUID receiptId,String message){}
 public record Create(String provider,long expectedVersion){}
 private <T>T local(UUID c,UUID b,Supplier<T> work){return tx.execute(t->{db.scope(c,b);return work.get();});}
 private UUID owner(Actor actor,UUID clinic){UUID owner=patient.ownPatient(actor,clinic);if(owner==null)throw ApiProblem.forbidden();return owner;}
 private Map<String,Object> bill(UUID id,UUID owner){var rows=jdbc.queryForList("select * from billing_v2.bills where id=? and patient_id=? for update",id,owner);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private Map<String,Object> bill(UUID id){var rows=jdbc.queryForList("select * from billing_v2.bills where id=? for update",id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private Map<String,Object> intent(UUID id){var rows=jdbc.queryForList("select * from billing_v2.payment_intents where id=?",id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private static long value(Map<String,Object> row,String name){return ((Number)row.get(name)).longValue();}
 private static long remaining(Map<String,Object> row){return value(row,"subtotal_vnd")-value(row,"adjustment_vnd")-value(row,"paid_vnd");}
 public static Intent view(Map<String,Object> row){String state=row.get("status").toString();Instant expiry=((Timestamp)row.get("expires_at")).toInstant();if(Set.of("CREATING","PENDING").contains(state)&&!expiry.isAfter(Instant.now()))state="EXPIRED";
  String message=switch(state){case "PAID"->"Phòng khám đã xác nhận nhận tiền. Biên nhận và công nợ đã được cập nhật.";case "CREATING"->"Chưa xác định được kết quả tạo liên kết. Kiểm tra lại cùng giao dịch trước khi tiếp tục.";case "EXPIRED"->"Liên kết đã hết hạn. Kiểm tra trạng thái trước khi tạo lượt thanh toán mới.";case "FAILED","CANCELLED"->"Giao dịch chưa thanh toán thành công. Bạn có thể chọn lại phương thức.";case "REVIEW_REQUIRED"->"Giao dịch cần lễ tân đối chiếu. Không thanh toán thêm; liên hệ phòng khám với mã giao dịch này.";default->"Đang chờ cổng thanh toán xác nhận. Quay lại trang không đồng nghĩa đã nhận tiền.";};
  return new Intent((UUID)row.get("id"),(UUID)row.get("bill_id"),row.get("provider").toString(),state,value(row,"amount_vnd"),"VND",(String)row.get("checkout_url"),(String)row.get("qr_code"),expiry,(UUID)row.get("receipt_id"),message);
 }
 public List<PaymentGateways.Method> methods(Actor actor,UUID c,UUID b,UUID billId){UUID owner=owner(actor,c);return local(c,b,()->{bill(billId,owner);return gateways.methods(c);});}
 public PaymentGateways.BankDetails bank(Actor actor,UUID c,UUID b,UUID billId){UUID owner=owner(actor,c);return local(c,b,()->{var bill=bill(billId,owner);long due=remaining(bill);if(due<=0)throw ApiProblem.conflict("Phiếu đã thanh toán đủ.");ensureUnreserved(jdbc,billId);return gateways.bank(c,billId,due);});}
 public List<Intent> list(Actor actor,UUID c,UUID b,UUID billId){UUID owner=owner(actor,c);return local(c,b,()->{bill(billId,owner);return jdbc.queryForList("select * from billing_v2.payment_intents where bill_id=? order by created_at desc limit 20",billId).stream().map(OnlinePaymentService::view).toList();});}
 public List<Intent> staffList(UUID c,UUID b,UUID billId){return local(c,b,()->jdbc.queryForList("select * from billing_v2.payment_intents where bill_id=? order by created_at desc limit 20",billId).stream().map(OnlinePaymentService::view).toList());}
 public List<PaymentGateways.Method> staffMethods(UUID c,UUID b,UUID billId){return local(c,b,()->{bill(billId);return gateways.methods(c);});}
 public PaymentGateways.BankDetails staffBank(UUID c,UUID b,UUID billId){return local(c,b,()->{var current=bill(billId);long due=remaining(current);if(due<=0)throw ApiProblem.conflict("Phiếu đã thanh toán đủ.");ensureUnreserved(jdbc,billId);return gateways.bank(c,billId,due);});}
 public Intent create(Actor actor,UUID c,UUID b,UUID billId,String key,Create input,String ip){
  UUID owner=owner(actor,c);if(input==null||!Set.of("PAYOS","VNPAY").contains(input.provider()))throw ApiProblem.invalid("Chọn cổng thanh toán phù hợp.");gateways.require(c,input.provider());
  if(key==null||!key.matches("[A-Za-z0-9_.:-]{1,120}"))throw ApiProblem.invalid("Yêu cầu cần mã chống ghi trùng.");String digest=hash(List.of(billId,input));
  UUID id=local(c,b,()->{
   var bill=bill(billId,owner);db.lock("online-command:"+actor.id()+":"+key);
   var previous=jdbc.queryForList("select resource_id,payload_hash from billing_v2.commands where actor_user_id=? and operation='online-create' and key=?",actor.id(),key);
   if(!previous.isEmpty()){if(!digest.equals(previous.getFirst().get("payload_hash")))throw ApiProblem.conflict("Mã yêu cầu đã được dùng với thông tin khác.");return (UUID)previous.getFirst().get("resource_id");}
   ensureUnreserved(jdbc,billId);long amount=remaining(bill);if(amount<=0||amount>9999999999L)throw ApiProblem.conflict("Phiếu không còn số dư phù hợp để thanh toán online.");if(input.expectedVersion()!=value(bill,"row_version"))throw ApiProblem.conflict("Phiếu thu vừa thay đổi. Tải lại số tiền trước khi thanh toán.");
   UUID created=UUID.randomUUID();String code=input.provider().equals("PAYOS")?Long.toString((created.getLeastSignificantBits()&0xFFFFFFFFFFFFL)+1):created.toString().replace("-","");
   jdbc.update("insert into billing_v2.payment_intents(id,clinic_id,branch_id,bill_id,patient_id,initiated_by,provider,provider_order_code,amount_vnd,client_ip,expires_at) values(?,?,?,?,?,?,?,?,?,?,now()+interval '15 minutes')",created,c,b,billId,owner,actor.id(),input.provider(),code,amount,ip);
   jdbc.update("insert into billing_v2.commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,resource_id) values(?,?,?,'online-create',?,?,?)",c,b,actor.id(),key,digest,created);return created;
  });
  return initialize(c,b,id);
 }
 public Intent createStaff(Actor actor,UUID c,UUID b,UUID billId,String key,Create input,String ip){
  if(actor==null||input==null||!Set.of("PAYOS","VNPAY").contains(input.provider()))throw ApiProblem.invalid("Chọn cổng thanh toán phù hợp.");gateways.require(c,input.provider());
  if(key==null||!key.matches("[A-Za-z0-9_.:-]{1,120}"))throw ApiProblem.invalid("Yêu cầu cần mã chống ghi trùng.");String digest=hash(List.of(billId,input));
  UUID id=local(c,b,()->{
   var current=bill(billId);db.lock("online-bill:"+billId);db.lock("online-command:"+actor.id()+":"+key);
   var previous=jdbc.queryForList("select resource_id,payload_hash from billing_v2.commands where actor_user_id=? and operation='online-staff-create' and key=?",actor.id(),key);
   if(!previous.isEmpty()){if(!digest.equals(previous.getFirst().get("payload_hash")))throw ApiProblem.conflict("Mã yêu cầu đã được dùng với thông tin khác.");return (UUID)previous.getFirst().get("resource_id");}
   long amount=remaining(current);if(amount<=0||amount>9999999999L)throw ApiProblem.conflict("Phiếu không còn số dư phù hợp để thanh toán online.");if(input.expectedVersion()!=value(current,"row_version"))throw ApiProblem.conflict("Phiếu thu vừa thay đổi. Tải lại số tiền trước khi thanh toán.");
   var reusable=jdbc.queryForList("select * from billing_v2.payment_intents where bill_id=? and provider=? and status in ('CREATING','PENDING') and expires_at>now() order by created_at desc limit 1",billId,input.provider());
   if(!reusable.isEmpty()){
    var row=reusable.getFirst();if(value(row,"amount_vnd")!=amount)throw ApiProblem.conflict("Giao dịch đang chờ có số tiền khác. Đối chiếu giao dịch hiện tại trước khi tiếp tục.");UUID existing=(UUID)row.get("id");
    jdbc.update("insert into billing_v2.commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,resource_id) values(?,?,?,'online-staff-create',?,?,?)",c,b,actor.id(),key,digest,existing);return existing;
   }
   ensureUnreserved(jdbc,billId);UUID created=UUID.randomUUID();String code=input.provider().equals("PAYOS")?Long.toString((created.getLeastSignificantBits()&0xFFFFFFFFFFFFL)+1):created.toString().replace("-","");
   jdbc.update("insert into billing_v2.payment_intents(id,clinic_id,branch_id,bill_id,patient_id,initiated_by,provider,provider_order_code,amount_vnd,client_ip,expires_at) values(?,?,?,?,?,?,?,?,?,?,now()+interval '15 minutes')",created,c,b,billId,current.get("patient_id"),actor.id(),input.provider(),code,amount,ip);
   jdbc.update("insert into billing_v2.commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,resource_id) values(?,?,?,'online-staff-create',?,?,?)",c,b,actor.id(),key,digest,created);return created;
  });
  return initialize(c,b,id);
 }
 private Intent initialize(UUID c,UUID b,UUID id){
  var current=local(c,b,()->intent(id));if(!"CREATING".equals(current.get("status"))||!((Timestamp)current.get("expires_at")).toInstant().isAfter(Instant.now()))return view(current);
  // HTTP is outside any database transaction; retries reuse this durable order code.
  try{
   var link=gateways.create(c,b,id,current.get("provider").toString(),current.get("provider_order_code").toString(),value(current,"amount_vnd"),((Timestamp)current.get("expires_at")).toInstant(),current.get("client_ip").toString());
   return local(c,b,()->{jdbc.update("update billing_v2.payment_intents set status='PENDING',checkout_url=?,qr_code=?,payment_link_id=?,last_error=null where id=? and status='CREATING'",link.checkoutUrl(),link.qrCode(),link.paymentLinkId(),id);return view(intent(id));});
  }catch(ApiProblem e){local(c,b,()->jdbc.update("update billing_v2.payment_intents set last_error='GATEWAY_INITIALIZATION_UNKNOWN' where id=? and status='CREATING'",id));return local(c,b,()->view(intent(id)));}
 }
 public Intent read(Actor actor,UUID c,UUID b,UUID billId,UUID id,boolean reconcile){
  UUID owner=owner(actor,c);var current=local(c,b,()->{bill(billId,owner);var row=intent(id);if(!billId.equals(row.get("bill_id")))throw ApiProblem.missing();return row;});
  if(!reconcile||Set.of("PAID","REVIEW_REQUIRED").contains(current.get("status")))return view(current);
  if("CREATING".equals(current.get("status"))&&((Timestamp)current.get("expires_at")).toInstant().isAfter(Instant.now()))return initialize(c,b,id);
  if("PAYOS".equals(current.get("provider"))){
   var data=gateways.payment(current.get("provider_order_code").toString());if(!current.get("provider_order_code").toString().equals(data.path("orderCode").asText()))throw ApiProblem.dependency("Mã giao dịch từ cổng thanh toán chưa khớp.");
   String state=data.path("status").asText();if("PAID".equals(state)){
    var transactions=data.path("transactions");String reference=transactions.isArray()&&transactions.size()>0?transactions.get(0).path("reference").asText():data.path("id").asText();
    confirm(c,b,"PAYOS",new PaymentGateways.Confirmation(data.path("orderCode").asText(),data.path("amountPaid").asLong(-1),"VND",reference,data.path("id").asText(),true));
   }else if(Set.of("CANCELLED","EXPIRED").contains(state))local(c,b,()->jdbc.update("update billing_v2.payment_intents set status=? where id=? and status in ('PENDING','CREATING')",state,id));
  }
  return local(c,b,()->view(intent(id)));
 }
 public Intent systemRead(UUID c,UUID b,UUID id,boolean reconcile){
  var current=local(c,b,()->intent(id));
  if(!reconcile||Set.of("PAID","REVIEW_REQUIRED").contains(current.get("status")))return view(current);
  if("CREATING".equals(current.get("status"))&&((Timestamp)current.get("expires_at")).toInstant().isAfter(Instant.now()))return initialize(c,b,id);
  if("PAYOS".equals(current.get("provider"))){
   var data=gateways.payment(current.get("provider_order_code").toString());if(!current.get("provider_order_code").toString().equals(data.path("orderCode").asText()))throw ApiProblem.dependency("Mã giao dịch từ cổng thanh toán chưa khớp.");
   String state=data.path("status").asText();if("PAID".equals(state)){
    var transactions=data.path("transactions");String reference=transactions.isArray()&&transactions.size()>0?transactions.get(0).path("reference").asText():data.path("id").asText();
    confirm(c,b,"PAYOS",new PaymentGateways.Confirmation(data.path("orderCode").asText(),data.path("amountPaid").asLong(-1),"VND",reference,data.path("id").asText(),true));
   }else if(Set.of("CANCELLED","EXPIRED").contains(state))local(c,b,()->jdbc.update("update billing_v2.payment_intents set status=? where id=? and status in ('PENDING','CREATING')",state,id));
  }
  return local(c,b,()->view(intent(id)));
 }
 public Intent cancel(Actor actor,UUID c,UUID b,UUID billId,UUID id,String key){
  if(key==null||!key.matches("[A-Za-z0-9_.:-]{1,120}"))throw ApiProblem.invalid("Yêu cầu cần mã chống ghi trùng.");
  var current=read(actor,c,b,billId,id,true);if(Set.of("PAID","REVIEW_REQUIRED","CANCELLED","EXPIRED","FAILED").contains(current.status()))return current;
  if(!"PAYOS".equals(current.provider()))throw ApiProblem.conflict("Hủy trên trang VNPAY và chờ xác nhận hoặc liên kết hết hạn trước khi chọn cách khác.");
  UUID owner=owner(actor,c);String code=local(c,b,()->intent(id).get("provider_order_code").toString());var proof=gateways.cancel(code);
  if(!code.equals(proof.path("orderCode").asText()))throw ApiProblem.dependency("Chưa đối chiếu được yêu cầu hủy với cổng thanh toán.");
  if("CANCELLED".equals(proof.path("status").asText()))return local(c,b,()->{bill(billId,owner);jdbc.update("update billing_v2.payment_intents set status='CANCELLED' where id=? and status in ('CREATING','PENDING')",id);return view(intent(id));});
  return read(actor,c,b,billId,id,true);
 }
 /** Signed callback entry: RLS uses the configured URL's tenant, never callback body scope. */
 public String confirm(UUID c,UUID b,String provider,PaymentGateways.Confirmation evidence){
  gateways.require(c,provider);
  return local(c,b,()->{
   var candidates=jdbc.queryForList("select * from billing_v2.payment_intents where provider=? and provider_order_code=?",provider,evidence.orderCode());if(candidates.isEmpty())return "NOT_FOUND";var row=candidates.getFirst();UUID id=(UUID)row.get("id"),billId=(UUID)row.get("bill_id");
   var bill=bill(billId,(UUID)row.get("patient_id"));row=intent(id); // all money operations serialize on the bill row
   if("PAID".equals(row.get("status")))return "ALREADY_PAID";
   if("REVIEW_REQUIRED".equals(row.get("status")))return "REVIEW_REQUIRED";
   if(evidence.reference()!=null&&!evidence.reference().isBlank())db.lock("gateway-reference:"+provider+":"+evidence.reference());
   var usedReference=jdbc.queryForList("select id from billing_v2.payment_intents where provider=? and confirmed_reference=? and id<>?",provider,evidence.reference(),id);if(!usedReference.isEmpty()){review(id,"GATEWAY_REFERENCE_ALREADY_USED",new PaymentGateways.Confirmation(evidence.orderCode(),evidence.amountVnd(),evidence.currency(),null,evidence.paymentLinkId(),true));return "REVIEW_REQUIRED";}
   boolean matches=evidence.amountVnd()==value(row,"amount_vnd")&&"VND".equals(evidence.currency())&&evidence.reference()!=null&&!evidence.reference().isBlank()&&evidence.reference().length()<=180&&(!provider.equals("PAYOS")||Objects.equals(row.get("payment_link_id"),evidence.paymentLinkId())||row.get("payment_link_id")==null&&"CREATING".equals(row.get("status")));
   if(!matches){if(evidence.paid())review(id,"GATEWAY_AMOUNT_OR_IDENTITY_MISMATCH",evidence);return "MISMATCH";}
   if(!evidence.paid()){jdbc.update("update billing_v2.payment_intents set status='FAILED' where id=? and status in ('CREATING','PENDING','EXPIRED')",id);return "FAILED";}
   if(provider.equals("PAYOS")){db.lock("incoming-bank:"+evidence.reference());if(jdbc.queryForObject("select count(*) from billing_v2.payments where external_ref=? and method in ('BANK_TRANSFER','PAYOS')",Integer.class,evidence.reference())>0){review(id,"BANK_REFERENCE_ALREADY_COLLECTED",evidence);return "REVIEW_REQUIRED";}}
   if(remaining(bill)<evidence.amountVnd()){review(id,"LATE_PAYMENT_OR_BALANCE_CHANGED",evidence);return "REVIEW_REQUIRED";}
   UUID payment=UUID.randomUUID(),initiator=(UUID)row.get("initiated_by");String reason="Cổng thanh toán đã xác nhận giao dịch "+provider;
   jdbc.update("insert into billing_v2.payments(id,clinic_id,branch_id,bill_id,amount_vnd,method,external_ref,reason,receipt_code) values(?,?,?,?,?,?,?,?,?)",payment,c,b,billId,evidence.amountVnd(),provider,evidence.reference(),reason,"RCT-"+payment);
   long paid=value(bill,"paid_vnd")+evidence.amountVnd();jdbc.update("update billing_v2.bills set paid_vnd=?,status=?,row_version=row_version+1 where id=?",paid,remaining(bill)==evidence.amountVnd()?"PAID":"PARTIALLY_PAID",billId);
   UUID journal=UUID.randomUUID();jdbc.update("insert into billing_v2.journals(id,clinic_id,branch_id,source_type,source_id,actor_user_id,reason) values(?,?,?,'PAYMENT',?,?,?)",journal,c,b,payment,initiator,reason);
   jdbc.update("insert into billing_v2.journal_lines(id,clinic_id,branch_id,journal_id,account,side,amount_vnd) values(?,?,?,?,?,'D',?),(?,?,?,?,'RECEIVABLE','C',?)",UUID.randomUUID(),c,b,journal,provider.equals("PAYOS")?"BANK":"GATEWAY_CLEARING",evidence.amountVnd(),UUID.randomUUID(),c,b,journal,evidence.amountVnd());
   jdbc.update("update billing_v2.payment_intents set status='PAID',receipt_id=?,confirmed_reference=?,confirmed_amount_vnd=?,confirmed_at=now(),last_error=null where id=?",payment,evidence.reference(),evidence.amountVnd(),id);
   jdbc.update("insert into billing_v2.history(id,clinic_id,branch_id,resource_id,actor_user_id,action,reason) values(?,?,?,?,?,'ONLINE_COLLECTED',?)",UUID.randomUUID(),c,b,payment,initiator,reason);
   emit(c,b,billId,payment,initiator,value(bill,"row_version")+2);return "PAID";
  });
 }
 private void review(UUID id,String error,PaymentGateways.Confirmation evidence){jdbc.update("update billing_v2.payment_intents set status='REVIEW_REQUIRED',last_error=?,confirmed_reference=?,confirmed_amount_vnd=?,confirmed_at=now() where id=?",error,evidence.reference(),evidence.amountVnd(),id);}
 public static void ensureUnreserved(JdbcTemplate jdbc,UUID bill){if(jdbc.queryForObject("select count(*) from billing_v2.payment_intents where bill_id=? and (status='REVIEW_REQUIRED' or (status in ('CREATING','PENDING') and expires_at>now()))",Integer.class,bill)>0)throw ApiProblem.conflict("Phiếu đang có giao dịch online cần xác nhận. Kiểm tra trạng thái trước khi thu thêm tiền hoặc giảm phí.");}
 private void emit(UUID c,UUID b,UUID bill,UUID payment,UUID actor,long version){UUID eventId=UUID.randomUUID();var event=new LinkedHashMap<String,Object>();event.put("specversion","1.0");event.put("id",eventId);event.put("source","/services/billing");event.put("type","clinic.billing.online_collected.v1");event.put("subject","billing/"+bill);event.put("time",Instant.now().toString());event.put("datacontenttype","application/json");event.put("clinicid",c);event.put("branchid",b);event.put("correlationid",UUID.randomUUID());event.put("aggregateversion",version);event.put("data",Map.of("billingId",bill,"resourceId",payment,"actorUserId",actor));jdbc.update("insert into billing_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",eventId,c,b,bill,"clinic.billing.online_collected.v1",write(event));}
 private String write(Object object){try{return json.writeValueAsString(object);}catch(Exception e){throw new IllegalStateException(e);}}
 private String hash(Object object){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(object)));}catch(Exception e){throw new IllegalStateException(e);}}
}
