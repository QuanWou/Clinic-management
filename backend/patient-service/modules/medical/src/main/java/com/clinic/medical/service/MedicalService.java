package com.clinic.medical.service;
import com.clinic.medical.api.*;
import com.clinic.medical.api.MedicalDto.*;
import com.clinic.medical.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.security.*;
import java.util.*;
import java.time.*;
import java.util.function.Supplier;
@Service public class MedicalService{
 private final JdbcTemplate jdbc;private final MedicalDb db;private final IamAuthorizationClient iam;private final MedicalSources sources;private final ObjectMapper json;private final TransactionTemplate tx;
 public MedicalService(JdbcTemplate jdbc,MedicalDb db,IamAuthorizationClient iam,MedicalSources sources,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.db=db;this.iam=iam;this.sources=sources;this.json=json;tx=new TransactionTemplate(manager);}
 private void require(Actor a,UUID c,UUID b,String role){if(a==null)throw ApiProblem.forbidden();var d=iam.decide(a.id(),"DOCTOR".equals(role)?"DOCTOR_WORK":"LAB_WORK",c,b);if(!d.allowed()||!"DOCTOR".equals(d.role()))throw ApiProblem.forbidden();}
 public void authorizeDoctorRealtime(Actor actor,UUID clinic,UUID branch){require(actor,clinic,branch,"DOCTOR");}
 private <T>T local(UUID c,UUID b,Supplier<T> body){return tx.execute(s->{db.scope(c,b);return body.get();});}
 private MedicalSources.Visit assigned(Actor a,UUID c,UUID b,UUID e){require(a,c,b,"DOCTOR");var visit=sources.visit(a,c,b,e);if(visit==null||!e.equals(visit.id())||!c.equals(visit.clinicId())||!b.equals(visit.branchId()))throw ApiProblem.forbidden();return visit;}
 private void ensure(MedicalSources.Visit v){jdbc.update("insert into medical_v2.cases(encounter_id,clinic_id,branch_id,patient_id,doctor_id) values(?,?,?,?,?) on conflict(encounter_id) do nothing",v.id(),v.clinicId(),v.branchId(),v.patientId(),v.doctorId());var row=caseRow(v.id());if(!v.patientId().equals(row.get("patient_id"))||!v.doctorId().equals(row.get("doctor_id")))throw ApiProblem.conflict("Encounter references changed");}
 private Map<String,Object> caseRow(UUID id){var rows=jdbc.queryForList("select * from medical_v2.cases where encounter_id=? for update",id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private void editable(UUID id,MedicalSources.Visit source){if(!"IN_PROGRESS".equals(source.status())||!"OPEN".equals(caseRow(id).get("status")))throw ApiProblem.conflict("Medical record can only be edited while this encounter is actively in progress");}
 private long bump(UUID id){return jdbc.queryForObject("update medical_v2.cases set row_version=row_version+1 where encounter_id=? returning row_version",Long.class,id);}
 public DraftView draft(Actor a,UUID c,UUID b,UUID e){assigned(a,c,b,e);return local(c,b,()->{var rows=jdbc.queryForList("select * from medical_v2.cases where encounter_id=?",e);if(rows.isEmpty())return new DraftView(e,0,0,"DRAFT",null,null,null,null);return draft(e);});}
 private DraftView draft(UUID e){var row=caseRow(e);long version=((Number)row.get("document_version")).longValue();if(version==0)return new DraftView(e,0,((Number)row.get("row_version")).longValue(),"DRAFT",null,null,null,null);var doc=jdbc.queryForMap("select * from medical_v2.document_versions where encounter_id=? and version=?",e,version);return new DraftView(e,version,((Number)row.get("row_version")).longValue(),"VALIDATED".equals(row.get("status"))?"VALIDATED":"DRAFT",parse(doc.get("content_json").toString(),Note.class),(UUID)doc.get("author_user_id"),((java.sql.Timestamp)doc.get("created_at")).toInstant(),doc.get("content_hash").toString());}
 public DraftView save(Actor a,UUID c,UUID b,UUID e,String key,DraftInput in){
  var source=assigned(a,c,b,e);check(key,in.reason());String digest=hash(List.of(e,in));
  return local(c,b,()->{db.lock("command:"+a.id()+":draft:"+key);db.lock("case:"+e);ensure(source);UUID replay=receipt(a,"draft",key,digest);if(replay!=null)return draft(e);editable(e,source);var row=caseRow(e);long version=((Number)row.get("document_version")).longValue();if(version!=in.expectedDocumentVersion())throw ApiProblem.conflict("Draft changed; reload without discarding your text");if(in.content()==null)throw ApiProblem.invalid("Draft content required");
   String body=write(in.content());if(body.length()>24000)throw ApiProblem.invalid("Draft exceeds supported size");UUID id=UUID.randomUUID();jdbc.update("insert into medical_v2.document_versions(id,encounter_id,clinic_id,branch_id,version,content_json,content_hash,author_user_id) values(?,?,?,?,?,?,?,?)",id,e,c,b,version+1,body,hash(in.content()),a.id());jdbc.update("update medical_v2.cases set document_version=? where encounter_id=?",version+1,e);long cv=bump(e);history(a,c,b,e,"DRAFT_SAVED",in.reason(),id,cv);command(a,c,b,"draft",key,digest,id);emit(a,c,b,e,id,cv,"clinic.medical.draft_saved.v1");return draft(e);
  });
 }
 public OrderView order(Actor a,UUID c,UUID b,UUID e,String key,OrderInput in){
  var source=assigned(a,c,b,e);check(key,in.reason());String digest=hash(List.of(e,in));
  UUID replay=local(c,b,()->receipt(a,"order",key,digest));if(replay!=null)return local(c,b,()->orderView(replay,true));
  var price=sources.price(a,c,b,in.offeringId());String offeringName=sources.offeringName(a,c,b,in.offeringId());
  return local(c,b,()->{db.lock("command:"+a.id()+":order:"+key);db.lock("case:"+e);ensure(source);UUID old=receipt(a,"order",key,digest);if(old!=null)return orderView(old,true);editable(e,source);if(((Number)caseRow(e).get("row_version")).longValue()!=in.expectedCaseVersion())throw ApiProblem.conflict("Case changed; reload");UUID id=UUID.randomUUID();jdbc.update("insert into medical_v2.orders(id,encounter_id,clinic_id,branch_id,offering_id,name,price_snapshot_json,ordered_by,state) values(?,?,?,?,?,?,?,?,'ORDERED')",id,e,c,b,in.offeringId(),offeringName,write(price),a.id());long v=bump(e);history(a,c,b,e,"ORDERED",in.reason(),id,v);command(a,c,b,"order",key,digest,id);emit(a,c,b,e,id,v,"clinic.medical.order_changed.v1");return orderView(id,true);});
 }
 public List<OrderView> orders(Actor a,UUID c,UUID b,UUID e){assigned(a,c,b,e);return local(c,b,()->jdbc.queryForList("select id from medical_v2.orders where encounter_id=? order by created_at",UUID.class,e).stream().map(id->orderView(id,true)).toList());}
 public record WorklistSummary(UUID encounterId,int pendingOrderCount,int unreviewedResultCount,Instant latestResultAt,String latestResultName){}
 public List<WorklistSummary> worklistSummaries(Actor a,UUID c,UUID b,List<UUID> ids){
  require(a,c,b,"DOCTOR");if(ids==null||ids.isEmpty()||ids.size()>200||ids.stream().anyMatch(Objects::isNull))throw ApiProblem.invalid("Use 1 to 200 visit references");
  var unique=ids.stream().distinct().toList();var allowed=sources.identities(a,c,b,unique).stream().map(MedicalSources.Visit::id).collect(java.util.stream.Collectors.toSet());
  if(allowed.size()!=unique.size()||!allowed.containsAll(unique))throw ApiProblem.forbidden();
  return local(c,b,()->{
   var args=new ArrayList<Object>(unique);
   String marks=String.join(",",Collections.nCopies(unique.size(),"?"));
   var rows=jdbc.queryForList("select o.encounter_id,count(*) filter(where o.state in ('ORDERED','ACCEPTED','PROCESSING')) pending_count,count(*) filter(where o.state='RESULTED') unreviewed_count,max(r.created_at) filter(where o.state='RESULTED') latest_result_at,(array_agg(o.name order by r.created_at desc) filter(where o.state='RESULTED' and r.id is not null))[1] latest_result_name from medical_v2.orders o left join medical_v2.results r on r.order_id=o.id and r.version=o.result_version where o.encounter_id in ("+marks+") group by o.encounter_id",args.toArray());
   var found=new HashMap<UUID,WorklistSummary>();for(var row:rows){UUID e=(UUID)row.get("encounter_id");Object ts=row.get("latest_result_at");found.put(e,new WorklistSummary(e,((Number)row.get("pending_count")).intValue(),((Number)row.get("unreviewed_count")).intValue(),ts==null?null:((java.sql.Timestamp)ts).toInstant(),(String)row.get("latest_result_name")));}
   return unique.stream().map(e->found.getOrDefault(e,new WorklistSummary(e,0,0,null,null))).toList();
  });
 }
 public List<OrderView> lab(Actor a,UUID c,UUID b){require(a,c,b,"LAB");var rows=local(c,b,()->jdbc.queryForList("select id from medical_v2.orders where ordered_by=? and state in ('ORDERED','ACCEPTED','PROCESSING','RESULTED') order by created_at limit 100",UUID.class,a.id()).stream().map(id->orderView(id,false)).toList());var visits=new HashMap<UUID,MedicalSources.Visit>();for(var v:sources.identities(a,c,b,rows.stream().map(OrderView::encounterId).distinct().toList()))visits.put(v.id(),v);return rows.stream().filter(o->visits.containsKey(o.encounterId())).map(o->o.withIdentity(visits.get(o.encounterId()))).toList();}
 public record OrderHistoryPage(List<OrderView> items,UUID nextAfter){}
 public OrderHistoryPage labHistory(Actor a,UUID c,UUID b,LocalDate from,LocalDate to,UUID after,int size){
  require(a,c,b,"LAB");
  LocalDate end=to==null?LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")):to;
  LocalDate start=from==null?end.minusDays(30):from;
  if(start.isAfter(end)||java.time.temporal.ChronoUnit.DAYS.between(start,end)>366||size<1||size>100)throw ApiProblem.invalid("Chọn khoảng ngày tối đa một năm và mỗi trang từ 1 đến 100 chỉ định.");
  var rows=local(c,b,()->{
   if(after!=null&&jdbc.queryForObject("select count(*) from medical_v2.orders where id=? and ordered_by=?",Integer.class,after,a.id())!=1)throw ApiProblem.invalid("Mốc tra cứu không còn hợp lệ. Tải lại lịch sử.");
   var args=new ArrayList<Object>();args.add(a.id());args.add(java.sql.Timestamp.from(start.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));args.add(java.sql.Timestamp.from(end.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant()));
   String cursor="";if(after!=null){cursor=" and (created_at,id)<(select created_at,id from medical_v2.orders where id=? and ordered_by=?)";args.add(after);args.add(a.id());}args.add(size+1);
   return jdbc.queryForList("select id from medical_v2.orders where ordered_by=? and created_at>=? and created_at<?"+cursor+" order by created_at desc,id desc limit ?",UUID.class,args.toArray()).stream().map(id->orderView(id,false)).toList();
  });
  boolean more=rows.size()>size;var page=rows.subList(0,Math.min(size,rows.size()));
  var visits=new HashMap<UUID,MedicalSources.Visit>();for(var v:sources.identities(a,c,b,page.stream().map(OrderView::encounterId).distinct().toList()))visits.put(v.id(),v);
  var visible=page.stream().filter(o->visits.containsKey(o.encounterId())).map(o->o.withIdentity(visits.get(o.encounterId()))).toList();
  return new OrderHistoryPage(visible,more?page.getLast().id():null);
 }
 public List<ResultView> resultHistory(Actor a,UUID c,UUID b,UUID id){
  require(a,c,b,"LAB");UUID visit=local(c,b,()->(UUID)orderRow(id).get("encounter_id"));assigned(a,c,b,visit);
  return local(c,b,()->jdbc.query("select * from medical_v2.results where order_id=? order by version desc limit 100",(rs,n)->new ResultView(rs.getObject("id",UUID.class),rs.getLong("version"),rs.getString("source_ref"),rs.getString("content"),rs.getString("content_hash"),rs.getObject("author_user_id",UUID.class),rs.getTimestamp("created_at").toInstant()),id));
 }
 public OrderView transition(Actor a,UUID c,UUID b,UUID id,String action,String key,Transition in){
  if(!Set.of("accept","process","reject","cancel").contains(action))throw ApiProblem.invalid("Unknown order action");
  boolean doctor="cancel".equals(action);require(a,c,b,doctor?"DOCTOR":"LAB");check(key,in.reason());String digest=hash(List.of(id,action,in));var initial=local(c,b,()->orderRow(id));
  var source=assigned(a,c,b,(UUID)initial.get("encounter_id"));
  return local(c,b,()->{db.lock("command:"+a.id()+":"+action+":"+key);UUID e=(UUID)initial.get("encounter_id");db.lock("case:"+e);var row=orderRow(id);UUID old=receipt(a,action,key,digest);if(old!=null)return orderView(old,doctor);
   if(!"OPEN".equals(caseRow(e).get("status")))throw ApiProblem.conflict("Case already validated");editable(e,source);if(((Number)row.get("row_version")).longValue()!=in.expectedVersion())throw ApiProblem.conflict("Order changed; reload");String state=row.get("state").toString(),next;
   switch(action){case "accept"->{if(!"ORDERED".equals(state))throw ApiProblem.conflict("Order already claimed");next="ACCEPTED";jdbc.update("update medical_v2.orders set accepted_by=? where id=?",a.id(),id);}
    case "process"->{if(!"ACCEPTED".equals(state)||!a.id().equals(row.get("accepted_by")))throw ApiProblem.forbidden();next="PROCESSING";}
    case "reject"->{if(!"ORDERED".equals(state)&&!("ACCEPTED".equals(state)&&a.id().equals(row.get("accepted_by"))))throw ApiProblem.conflict("Order cannot be rejected");next="REJECTED";}
    default->{if(!Set.of("ORDERED","ACCEPTED","PROCESSING").contains(state))throw ApiProblem.conflict("Resulted order cannot be cancelled");next="CANCELLED";}}
   jdbc.update("update medical_v2.orders set state=?,row_version=row_version+1 where id=?",next,id);long v=bump(e);history(a,c,b,e,"ORDER_"+next,in.reason(),id,v);command(a,c,b,action,key,digest,id);emit(a,c,b,e,id,v,"clinic.medical.order_changed.v1");return orderView(id,doctor);
  });
 }
 public OrderView result(Actor a,UUID c,UUID b,UUID id,String key,ResultInput in){
  require(a,c,b,"LAB");check(key,in.reason());String digest=hash(List.of(id,in));var initial=local(c,b,()->orderRow(id));assigned(a,c,b,(UUID)initial.get("encounter_id"));
  return local(c,b,()->{db.lock("command:"+a.id()+":result:"+key);UUID e=(UUID)initial.get("encounter_id");db.lock("case:"+e);var row=orderRow(id);UUID old=receipt(a,"result",key,digest);if(old!=null)return orderView(old,false);if(!"OPEN".equals(caseRow(e).get("status")))throw ApiProblem.conflict("Case validated");if(!a.id().equals(row.get("accepted_by")))throw ApiProblem.forbidden();if(!Set.of("PROCESSING","RESULTED").contains(row.get("state"))||((Number)row.get("row_version")).longValue()!=in.expectedVersion())throw ApiProblem.conflict("Order changed or not processing");if(in.content()==null||in.content().isBlank()||in.content().length()>8000||in.sourceRef()==null||in.sourceRef().isBlank()||in.sourceRef().length()>200)throw ApiProblem.invalid("Bounded authenticated result required");
   long rv=((Number)row.get("result_version")).longValue()+1;UUID rid=UUID.randomUUID();jdbc.update("insert into medical_v2.results(id,order_id,clinic_id,branch_id,version,author_user_id,source_ref,content,content_hash) values(?,?,?,?,?,?,?,?,?)",rid,id,c,b,rv,a.id(),in.sourceRef().trim(),in.content(),hash(in.content()));jdbc.update("update medical_v2.orders set state='RESULTED',result_version=?,row_version=row_version+1 where id=?",rv,id);long cv=bump(e);history(a,c,b,e,"RESULT_AUTHORED",in.reason(),rid,cv);command(a,c,b,"result",key,digest,id);emit(a,c,b,e,id,cv,"clinic.medical.result_recorded.v1");return orderView(id,false);
  });
 }
 public OrderView review(Actor a,UUID c,UUID b,UUID id,String key,ReviewInput in){
  require(a,c,b,"DOCTOR");
  var initial=local(c,b,()->orderRow(id));UUID e=(UUID)initial.get("encounter_id");var source=assigned(a,c,b,e);check(key,in.reason());String digest=hash(List.of(id,in));
  return local(c,b,()->{db.lock("command:"+a.id()+":review:"+key);db.lock("case:"+e);var row=orderRow(id);UUID old=receipt(a,"review",key,digest);if(old!=null)return orderView(old,true);editable(e,source);if(!"RESULTED".equals(row.get("state"))||((Number)row.get("row_version")).longValue()!=in.expectedVersion()||((Number)row.get("result_version")).longValue()!=in.resultVersion())throw ApiProblem.conflict("Authenticated current result required");var result=jdbc.queryForMap("select * from medical_v2.results where order_id=? and version=?",id,in.resultVersion());jdbc.update("insert into medical_v2.reviews(id,order_id,clinic_id,branch_id,result_id,author_user_id,reason) values(?,?,?,?,?,?,?)",UUID.randomUUID(),id,c,b,result.get("id"),a.id(),in.reason().trim());jdbc.update("update medical_v2.orders set state='REVIEWED',row_version=row_version+1 where id=?",id);long cv=bump(e);history(a,c,b,e,"RESULT_REVIEWED",in.reason(),id,cv);command(a,c,b,"review",key,digest,id);emit(a,c,b,e,id,cv,"clinic.medical.result_reviewed.v1");return orderView(id,true);});
 }
 public DraftView validate(Actor a,UUID c,UUID b,UUID e,String key,Transition in){
  var source=assigned(a,c,b,e);check(key,in.reason());String digest=hash(List.of(e,in));
  return local(c,b,()->{db.lock("command:"+a.id()+":validate:"+key);db.lock("case:"+e);var row=caseRow(e);UUID old=receipt(a,"validate",key,digest);if(old!=null)return draft(e);
   if(!Set.of("IN_PROGRESS","COMPLETION_PENDING").contains(source.status())||!"OPEN".equals(row.get("status"))||((Number)row.get("row_version")).longValue()!=in.expectedVersion())throw ApiProblem.conflict("Case changed or cannot validate");
   var d=draft(e);if(d.content()==null||blank(d.content().reasonForVisit())||blank(d.content().conclusion())||blank(d.content().instructions()))throw ApiProblem.invalid("Reason for visit, conclusion and instructions are required");
   if(jdbc.queryForObject("select count(*) from medical_v2.orders where encounter_id=? and state not in ('REVIEWED','REJECTED','CANCELLED')",Integer.class,e)>0)throw ApiProblem.conflict("Every active order needs an authenticated reviewed result");
   jdbc.update("update medical_v2.cases set status='VALIDATED' where encounter_id=?",e);long cv=bump(e);history(a,c,b,e,"CLINICAL_VALIDATED",in.reason(),e,cv);command(a,c,b,"validate",key,digest,e);emit(a,c,b,e,e,cv,"clinic.medical.validated.v1");return draft(e);
  });
 }
 public record Readiness(UUID encounterId,UUID clinicId,UUID branchId,long caseVersion,String status,boolean ready){}
 public Readiness readiness(Actor a,UUID c,UUID b,UUID e){
  assigned(a,c,b,e);
  return local(c,b,()->{var row=caseRow(e);String status=row.get("status").toString();return new Readiness(e,c,b,((Number)row.get("row_version")).longValue(),status,"VALIDATED".equals(status));});
 }
 private boolean blank(String s){return s==null||s.isBlank();}
 private Map<String,Object> orderRow(UUID id){var rows=jdbc.queryForList("select * from medical_v2.orders where id=? for update",id);if(rows.isEmpty())throw ApiProblem.missing();return rows.getFirst();}
 private OrderView orderView(UUID id,boolean doctor){var o=orderRow(id);ResultView result=null;long version=((Number)o.get("result_version")).longValue();if(version>0){var row=jdbc.queryForMap("select * from medical_v2.results where order_id=? and version=?",id,version);result=new ResultView((UUID)row.get("id"),version,row.get("source_ref").toString(),row.get("content").toString(),row.get("content_hash").toString(),(UUID)row.get("author_user_id"),((java.sql.Timestamp)row.get("created_at")).toInstant());}var reviews=jdbc.queryForList("select author_user_id,created_at from medical_v2.reviews where order_id=? order by created_at desc limit 1",id);UUID reviewer=reviews.isEmpty()?null:(UUID)reviews.getFirst().get("author_user_id");Instant reviewedAt=reviews.isEmpty()?null:((java.sql.Timestamp)reviews.getFirst().get("created_at")).toInstant();return new OrderView(id,(UUID)o.get("encounter_id"),(UUID)o.get("offering_id"),o.get("name").toString(),o.get("state").toString(),((Number)o.get("row_version")).longValue(),version,(UUID)o.get("accepted_by"),result,reviewer,((java.sql.Timestamp)o.get("created_at")).toInstant(),reviewedAt);}
 private UUID receipt(Actor a,String op,String key,String digest){var rows=jdbc.queryForList("select resource_id,payload_hash from medical_v2.commands where actor_user_id=? and operation=? and key=?",a.id(),op,key);if(rows.isEmpty())return null;if(!digest.equals(rows.getFirst().get("payload_hash")))throw new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","Key payload changed");return (UUID)rows.getFirst().get("resource_id");}
 private void command(Actor a,UUID c,UUID b,String op,String key,String digest,UUID id){jdbc.update("insert into medical_v2.commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,resource_id) values(?,?,?,?,?,?,?)",c,b,a.id(),op,key,digest,id);}
 private void check(String key,String reason){if(key==null||key.isBlank()||key.length()>120||reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("Bounded key and reason required");}
 private void history(Actor a,UUID c,UUID b,UUID e,String action,String reason,UUID resource,long version){jdbc.update("insert into medical_v2.history(id,clinic_id,branch_id,encounter_id,actor_user_id,action,reason,resource_id,version) values(?,?,?,?,?,?,?,?,?)",UUID.randomUUID(),c,b,e,a.id(),action,reason.trim(),resource,version);}
 private void emit(Actor a,UUID c,UUID b,UUID e,UUID resource,long version,String type){UUID id=UUID.randomUUID();var event=new LinkedHashMap<String,Object>();event.put("specversion","1.0");event.put("id",id.toString());event.put("source","/services/medical");event.put("type",type);event.put("subject","encounter/"+e);event.put("time",Instant.now().toString());event.put("datacontenttype","application/json");event.put("clinicid",c.toString());event.put("branchid",b.toString());event.put("correlationid",UUID.randomUUID().toString());event.put("aggregateversion",version);event.put("data",Map.of("encounterId",e.toString(),"resourceId",resource.toString(),"actorUserId",a.id().toString()));jdbc.update("insert into medical_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",id,c,b,e,type,write(event));}
 private String write(Object o){try{return json.writeValueAsString(o);}catch(Exception ex){throw new IllegalStateException(ex);}}
 private <T>T parse(String s,Class<T> type){try{return json.readValue(s,type);}catch(Exception ex){throw new IllegalStateException(ex);}}
 private String hash(Object body){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body)));}catch(Exception ex){throw new IllegalStateException(ex);}}
}
