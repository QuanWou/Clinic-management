package com.clinic.encounter.service;
import com.clinic.encounter.api.*;
import com.clinic.encounter.api.EncounterDto.*;
import com.clinic.encounter.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
@Service
public class EncounterService {
 private final JdbcTemplate jdbc;private final EncounterDb db;private final IamAuthorizationClient iam;private final ClinicDirectoryClient clinics;private final EncounterSources sources;private final MedicalReadinessClient medical;private final TransactionTemplate tx;private final ObjectMapper json;private final PatientViews patientViews;
 public EncounterService(JdbcTemplate jdbc,EncounterDb db,IamAuthorizationClient iam,ClinicDirectoryClient clinics,EncounterSources sources,MedicalReadinessClient medical,PlatformTransactionManager manager,ObjectMapper json,PatientViews patientViews){this.jdbc=jdbc;this.db=db;this.iam=iam;this.clinics=clinics;this.sources=sources;this.medical=medical;this.tx=new TransactionTemplate(manager);this.json=json;this.patientViews=patientViews;}
 private void require(Actor actor,String capability,UUID clinic,UUID branch){if(actor==null||!iam.decide(actor.id(),capability,clinic,branch).allowed())throw ApiProblem.forbidden();}
 private void requireAny(Actor actor,UUID clinic,UUID branch,String... capabilities){if(actor==null)throw ApiProblem.forbidden();for(String capability:capabilities)if(iam.decide(actor.id(),capability,clinic,branch).allowed())return;throw ApiProblem.forbidden();}
 private <T>T local(UUID clinic,UUID branch,Supplier<T> body){var value=tx.execute(s->{db.scope(clinic,branch);return body.get();});return patientViews.enrich(clinic,branch,value);}
 public PointView point(Actor actor,UUID clinic,UUID branch,PointInput in){require(actor,"CLINIC_CONFIG",clinic,branch);clinics.requireBranch(clinic,branch);return local(clinic,branch,()->{UUID id=UUID.randomUUID();jdbc.update("insert into encounter_v2.service_points(id,clinic_id,branch_id,code,name) values(?,?,?,?,?)",id,clinic,branch,in.code(),in.name().trim());return new PointView(id,in.code(),in.name().trim(),true);});}
 public List<PointView> points(Actor actor,UUID clinic,UUID branch){require(actor,"RECEPTION",clinic,branch);return local(clinic,branch,()->jdbc.query("select * from encounter_v2.service_points where active order by code",(rs,n)->new PointView(rs.getObject("id",UUID.class),rs.getString("code"),rs.getString("name"),rs.getBoolean("active"))));}
 public List<EncounterSources.ArrivalItem> appointments(Actor actor,UUID clinic,UUID branch,LocalDate date){require(actor,"RECEPTION",clinic,branch);var rows=sources.appointments(clinic,branch,date);var summaries=new HashMap<UUID,PatientSummary>();for(var p:sources.identities(clinic,rows.stream().map(EncounterSources.ArrivalItem::patientId).distinct().toList()))summaries.put(p.patientId(),p);return rows.stream().map(a->a.withPatient(summaries.get(a.patientId()))).toList();}
 public record ExceptionInput(@jakarta.validation.constraints.Pattern(regexp="LATE|NO_SHOW|DOCTOR_ABSENT") @jakarta.validation.constraints.NotBlank String type,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=500) String reason){}
 public List<EncounterSources.ExceptionView> openExceptions(Actor actor,UUID clinic,UUID branch){requireAny(actor,clinic,branch,"RECEPTION","OPERATIONS_VIEW");return sources.openExceptions(clinic,branch);}
 public List<EncounterSources.ExceptionView> exceptions(Actor actor,UUID clinic,UUID branch,UUID appointmentId){requireAny(actor,clinic,branch,"RECEPTION","OPERATIONS_VIEW");return sources.exceptions(clinic,branch,appointmentId);}
 public EncounterSources.ExceptionView exception(Actor actor,UUID clinic,UUID branch,UUID appointmentId,String key,ExceptionInput in){require(actor,"DOCTOR_ABSENT".equals(in.type())?"CLINIC_CONFIG":"RECEPTION",clinic,branch);checkKey(key);var booking=sources.booking(clinic,branch,appointmentId);return sources.exception(clinic,branch,appointmentId,key,new EncounterSources.ExceptionInput(actor.id(),booking.version(),in.type(),in.reason()));}
 public record ResolutionInput(@jakarta.validation.constraints.Min(0) long expectedVersion,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=500) String reason){}
 public EncounterSources.ExceptionView resolve(Actor actor,UUID clinic,UUID branch,UUID appointment,UUID exception,String key,ResolutionInput in){require(actor,"CLINIC_CONFIG",clinic,branch);checkKey(key);return sources.resolve(clinic,branch,appointment,exception,key,new EncounterSources.ResolutionInput(actor.id(),in.expectedVersion(),in.reason()));}
 public VisitView walkIn(Actor actor,UUID clinic,UUID branch,String key,WalkInInput in){
  require(actor,"RECEPTION",clinic,branch);clinics.requireBranch(clinic,branch);checkKey(key);
  String hash=hash(in);
  var previous=local(clinic,branch,()->{UUID replay=receipt(actor,clinic,branch,"walk-in",key,hash);return replay==null?null:visit(replay);});if(previous!=null)return previous;
  if(in.offeringId()==null)throw ApiProblem.invalid("Chọn dịch vụ khám trước khi tiếp nhận.");
  var link=sources.patient(clinic,in.patientId());var candidates=sources.receptionCandidates(actor,clinic,branch,in.offeringId());var consultation=sources.consultation(actor,clinic,branch,in.offeringId());
  if(consultation==null||!in.offeringId().equals(consultation.offeringId())||consultation.price()==null)throw ApiProblem.invalid("Dịch vụ và giá khám phải được xác minh.");
  return local(clinic,branch,()->{
   db.lock("walk-in:"+clinic+":"+branch+":"+actor.id()+":"+key);
   UUID replay=receipt(actor,clinic,branch,"walk-in",key,hash);if(replay!=null)return visit(replay);
   db.lock("reception-routing:"+clinic+":"+branch);
   if(in.doctorId()==null){db.lock("walk-in-patient:"+clinic+":"+branch+":"+in.patientId());if(jdbc.queryForObject("select count(*) from encounter_v2.visits where patient_id=? and status in ('ARRIVAL_PENDING','WAITING','IN_PROGRESS','AWAITING_RESULTS')",Integer.class,in.patientId())>0)throw ApiProblem.conflict("Bệnh nhân đã có lượt đang tiếp nhận hoặc đang khám. Tra cứu hàng đợi trước khi tạo lượt mới.");}
   var doctor=candidates.stream().filter(d->in.doctorId()==null||in.doctorId().equals(d.doctorId())).min(Comparator.<EncounterSources.DoctorAssignment>comparingInt(d->jdbc.queryForObject("select count(*) from encounter_v2.visits where doctor_id=? and status in ('WAITING','IN_PROGRESS','AWAITING_RESULTS')",Integer.class,d.doctorId())).thenComparing(d->d.doctorId().toString())).orElseThrow(()->new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"NO_ELIGIBLE_DOCTOR","Hiện chưa có bác sĩ phù hợp đang nhận bệnh nhân cho lựa chọn này. Chọn dịch vụ khác hoặc tạo yêu cầu xử lý."));
   requirePoint(in.servicePointId());UUID id=UUID.randomUUID();
   jdbc.update("insert into encounter_v2.visits(id,clinic_id,branch_id,patient_id,clinic_patient_link_id,doctor_id,doctor_user_id,service_point_id,status) values(?,?,?,?,?,?,?,?,'WAITING')",id,clinic,branch,in.patientId(),link.id(),doctor.doctorId(),doctor.userId(),in.servicePointId());
   jdbc.update("update encounter_v2.visits set consultation_json=?::jsonb where id=?",write(consultation),id);
   receiptInsert(actor,clinic,branch,"walk-in",key,hash,id,in.servicePointId(),in.reason());activate(actor,clinic,branch,id,in.servicePointId(),in.reason());return visit(id);
  });
 }
 public record AbsenceBatch(int recorded,List<UUID> retryRequired,boolean hasMore){}
 public AbsenceBatch applyAbsence(Actor actor,UUID clinic,UUID branch,UUID id){
  require(actor,"CLINIC_CONFIG",clinic,branch);clinics.requireBranch(clinic,branch);var absence=sources.absence(clinic,branch,id);if(!"ACTIVE".equals(absence.state()))throw ApiProblem.conflict("Absence is cancelled; reload source");var affected=sources.affected(clinic,branch,absence);int recorded=0;List<UUID> retry=new ArrayList<>();
  for(var a:affected.stream().limit(10).toList()){try{var booking=sources.booking(clinic,branch,a.id());if(!absence.doctorId().equals(booking.doctorId()))throw ApiProblem.conflict("Doctor changed");var result=sources.exception(clinic,branch,a.id(),"absence:"+id+":"+a.id(),new EncounterSources.ExceptionInput(actor.id(),booking.version(),"DOCTOR_ABSENT","Doctor absence source "+id,id,absence.doctorId(),absence.startsAt(),absence.endsAt()));if(result==null||!a.id().equals(result.appointmentId())||!"DOCTOR_ABSENT".equals(result.type()))throw ApiProblem.dependency("Absence acknowledgement invalid");recorded++;}catch(ApiProblem ex){retry.add(a.id());}}
  return new AbsenceBatch(recorded,retry,affected.size()>10);
 }
 public VisitView checkIn(Actor actor,UUID clinic,UUID branch,UUID appointmentId,String key,CheckInInput in){
  require(actor,"RECEPTION",clinic,branch);clinics.requireBranch(clinic,branch);checkKey(key);String hash=hash(List.of(appointmentId,in));
  var booking=sources.booking(clinic,branch,appointmentId);
  if(!in.patientId().equals(booking.patientId())||!Set.of("CONFIRMED","CHECKED_IN").contains(booking.status()))throw ApiProblem.conflict("Appointment cannot be checked in");
  if(!LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).equals(booking.startsAt().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate()))throw ApiProblem.conflict("Appointment arrival requires its scheduled date");
  var link=sources.patient(clinic,in.patientId());if(!link.id().equals(booking.clinicPatientLinkId()))throw ApiProblem.conflict("Patient link changed");
  var doctor=sources.doctor(clinic,branch,booking.doctorId());
  UUID id=local(clinic,branch,()->{
   db.lock("appointment-arrival:"+clinic+":"+appointmentId);
   UUID replay=receipt(actor,clinic,branch,"check-in",key,hash);if(replay!=null)return replay;
   requirePoint(in.servicePointId());
   var existing=jdbc.queryForList("select id from encounter_v2.visits where appointment_id=?",UUID.class,appointmentId);
   UUID visitId=existing.isEmpty()?UUID.randomUUID():existing.getFirst();
   if(existing.isEmpty())jdbc.update("insert into encounter_v2.visits(id,clinic_id,branch_id,patient_id,clinic_patient_link_id,appointment_id,doctor_id,doctor_user_id,service_point_id,status) values(?,?,?,?,?,?,?,?,?,'ARRIVAL_PENDING')",visitId,clinic,branch,in.patientId(),link.id(),appointmentId,doctor.doctorId(),doctor.userId(),in.servicePointId());
   receiptInsert(actor,clinic,branch,"check-in",key,hash,visitId,in.servicePointId(),in.reason());return visitId;
  });
  // The source claim runs outside the local database transaction. A retry resumes this same visit after a lost response.
  var claimed=sources.claim(clinic,branch,appointmentId,in.patientId(),id,actor.id(),booking.version());
  // The successful source claim freezes the booking. A concurrent pre-arrival change
  // may have replaced the doctor since reservation; activate only its acknowledged assignment.
  var claimedDoctor=doctor.doctorId().equals(claimed.doctorId())?doctor:sources.doctor(clinic,branch,claimed.doctorId());
  return local(clinic,branch,()->{
   db.lock("visit:"+id);var v=visit(id);if(!"ARRIVAL_PENDING".equals(v.status()))return v;
   jdbc.update("update encounter_v2.visits set doctor_id=?,doctor_user_id=? where id=?",claimedDoctor.doctorId(),claimedDoctor.userId(),id);
   UUID point=jdbc.queryForObject("select service_point_id from encounter_v2.visits where id=?",UUID.class,id);
   jdbc.update("update encounter_v2.visits set status='WAITING',row_version=row_version+1 where id=?",id);activate(actor,clinic,branch,id,point,in.reason());return visit(id);
  });
 }
 private void activate(Actor actor,UUID clinic,UUID branch,UUID visitId,UUID point,String reason){
  jdbc.update("insert into encounter_v2.check_ins(visit_id,clinic_id,branch_id,actor_user_id) values(?,?,?,?)",visitId,clinic,branch,actor.id());
  jdbc.update("update encounter_v2.visits set checked_in_at=now(),row_version=row_version+1 where id=?",visitId);ticket(clinic,branch,visitId,point);history(actor,clinic,branch,visitId,"CHECKED_IN",reason,null,"WAITING");emit(actor,clinic,branch,visitId,"clinic.encounter.checked_in.v1");
 }
 private void ticket(UUID clinic,UUID branch,UUID visitId,UUID point){
  String prefix=requirePoint(point);LocalDate date=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
  int number=jdbc.queryForObject("insert into encounter_v2.queue_counters(clinic_id,branch_id,service_point_id,queue_date,value) values(?,?,?,?,1) on conflict(clinic_id,branch_id,service_point_id,queue_date) do update set value=encounter_v2.queue_counters.value+1 returning value",Integer.class,clinic,branch,point,date);
  String code=prefix+"-"+date.toString().replace("-","")+"-"+String.format(Locale.ROOT,"%04d",number);
  jdbc.update("insert into encounter_v2.queue_tickets(id,visit_id,clinic_id,branch_id,service_point_id,queue_date,number,code,state) values(?,?,?,?,?,?,?,?,'WAITING')",UUID.randomUUID(),visitId,clinic,branch,point,date,number,code);
 }
 private String requirePoint(UUID point){var points=jdbc.queryForList("select code from encounter_v2.service_points where id=? and active",String.class,point);if(points.isEmpty())throw ApiProblem.invalid("Service point does not belong to this active branch");return points.getFirst();}
 public List<TicketView> queue(Actor actor,UUID clinic,UUID branch,UUID point,LocalDate date){require(actor,"RECEPTION",clinic,branch);return local(clinic,branch,()->{requirePoint(point);return jdbc.query("select * from encounter_v2.queue_tickets where service_point_id=? and queue_date=? order by number limit 200",(rs,n)->ticketView(rs),point,date);});}
 public TicketView move(Actor actor,UUID clinic,UUID branch,UUID id,String action,QueueInput in){return move(actor,clinic,branch,id,action,in,null);}
 public TicketView move(Actor actor,UUID clinic,UUID branch,UUID id,String action,QueueInput in,String key){
  if(key!=null)checkKey(key);String digest=hash(List.of(id,action,in));
  if("transfer".equals(action))requireManager(actor,clinic,branch);
  require(actor,"RECEPTION",clinic,branch);return local(clinic,branch,()->{
   var rows=jdbc.query("select * from encounter_v2.queue_tickets where id=?",(rs,n)->ticketView(rs),id);if(rows.isEmpty())throw ApiProblem.missing();
   if(key!=null){db.lock("queue-command:"+actor.id()+":"+action+":"+key);if(careReplay(actor,rows.getFirst().visitId(),"queue-"+action,key,digest))return jdbc.queryForObject("select * from encounter_v2.queue_tickets where id=?",(rs,n)->ticketView(rs),id);}
   db.lock("visit:"+rows.getFirst().visitId());var t=jdbc.queryForObject("select * from encounter_v2.queue_tickets where id=? for update",(rs,n)->ticketView(rs),id);if(t.version()!=in.expectedVersion())throw ApiProblem.conflict("Ticket changed; reload");
   if(!t.date().equals(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))throw ApiProblem.conflict("Queue action requires the current local date");
   if(!Set.of("WAITING","AWAITING_RESULTS").contains(visit(t.visitId()).status()))throw ApiProblem.conflict("Visit is already in care or closed");
   String next;
   if("call".equals(action)){
    if(!"WAITING".equals(t.state()))throw ApiProblem.conflict("Only a waiting ticket can be called");
    UUID ticketDoctor=jdbc.queryForObject("select doctor_id from encounter_v2.visits where id=?",UUID.class,t.visitId());
    db.lock("queue-doctor-point:"+ticketDoctor+":"+t.servicePointId()+":"+t.date());
    if(jdbc.queryForObject("select count(*) from encounter_v2.queue_tickets qt join encounter_v2.visits v on v.id=qt.visit_id where qt.service_point_id=? and qt.queue_date=? and v.doctor_id=? and qt.state in ('CALLED','SERVING')",Integer.class,t.servicePointId(),t.date(),ticketDoctor)>0)throw ApiProblem.conflict("Doctor already has a called or serving patient at this service point");
    UUID first=jdbc.queryForObject("select qt.id from encounter_v2.queue_tickets qt join encounter_v2.visits v on v.id=qt.visit_id where qt.service_point_id=? and qt.queue_date=? and v.doctor_id=? and qt.state='WAITING' order by qt.number limit 1",UUID.class,t.servicePointId(),t.date(),ticketDoctor);
    if(!id.equals(first))throw ApiProblem.conflict("Call the first waiting ticket for this doctor or skip it with a reason");next="CALLED";
   }else if("skip".equals(action)){if(!Set.of("WAITING","CALLED").contains(t.state()))throw ApiProblem.conflict("Ticket cannot be skipped");next="SKIPPED";
   }else if("recall".equals(action)){if(!"CALLED".equals(t.state()))throw ApiProblem.conflict("Chỉ gọi lại lượt đã được gọi.");next="CALLED";
   }else if("absent".equals(action)){if(!Set.of("WAITING","CALLED","SKIPPED").contains(t.state()))throw ApiProblem.conflict("Không thể ghi vắng lượt này.");next="ABSENT";
   }else if("requeue".equals(action)){if(!Set.of("SKIPPED","ABSENT").contains(t.state()))throw ApiProblem.conflict("Chỉ đưa lại lượt bỏ qua hoặc vắng.");if(jdbc.queryForObject("select count(*) from encounter_v2.queue_tickets where visit_id=? and state in ('WAITING','CALLED','SERVING')",Integer.class,t.visitId())>0)throw ApiProblem.conflict("Lượt này đã có số đang hoạt động.");next="TRANSFERRED";
   }else if("transfer".equals(action)){if(!Set.of("WAITING","CALLED","SKIPPED").contains(t.state())||in.destinationPointId()==null)throw ApiProblem.conflict("Ticket cannot be transferred");requirePoint(in.destinationPointId());next="TRANSFERRED";
   }else throw ApiProblem.invalid("Unknown queue action");
   jdbc.update("update encounter_v2.queue_tickets set state=?,row_version=row_version+1 where id=?",next,id);
   if("TRANSFERRED".equals(next)){UUID destination="requeue".equals(action)?t.servicePointId():in.destinationPointId();jdbc.update("update encounter_v2.visits set service_point_id=? where id=?",destination,t.visitId());ticket(clinic,branch,t.visitId(),destination);}
   jdbc.update("update encounter_v2.visits set row_version=row_version+1 where id=?",t.visitId());
   if(key!=null)careReceipt(actor,clinic,branch,t.visitId(),"queue-"+action,key,digest);
   history(actor,clinic,branch,t.visitId(),"QUEUE_"+action.toUpperCase(Locale.ROOT),in.reason(),t.state(),next);emit(actor,clinic,branch,t.visitId(),"clinic.encounter.queue_changed.v1");
   return jdbc.queryForObject("select * from encounter_v2.queue_tickets where id=?",(rs,n)->ticketView(rs),id);
  });
 }
 public VisitView read(Actor actor,UUID clinic,UUID branch,UUID id){require(actor,"RECEPTION",clinic,branch);return local(clinic,branch,()->visit(id));}
 public void authorizeDoctorRealtime(Actor actor,UUID clinic,UUID branch){requireDoctor(actor,clinic,branch);}
 public void authorizeOperationsRealtime(Actor actor,UUID clinic,UUID branch){requireAny(actor,clinic,branch,"RECEPTION","OPERATIONS_VIEW","BILLING");}
 public void authorizeReception(Actor actor,UUID clinic,UUID branch){require(actor,"RECEPTION",clinic,branch);}
 public record ArrivalRecovery(String operation,Instant createdAt,VisitView visit){}
 public record ReceptionPage(List<ArrivalRecovery> items,UUID nextAfter){}
 public ReceptionPage receptionWorkload(Actor actor,UUID clinic,UUID branch,LocalDate date,UUID after){
  require(actor,"RECEPTION",clinic,branch);var zone=ZoneId.of("Asia/Ho_Chi_Minh");var start=java.sql.Timestamp.from(date.atStartOfDay(zone).toInstant());var end=java.sql.Timestamp.from(date.plusDays(1).atStartOfDay(zone).toInstant());
  return local(clinic,branch,()->{var rows=jdbc.queryForList("select id,appointment_id,created_at from encounter_v2.visits where created_at>=? and created_at<? and id>? order by id limit 101",start,end,after==null?new UUID(0,0):after);var page=rows.stream().limit(100).map(r->new ArrivalRecovery(r.get("appointment_id")==null?"walk-in":"check-in",((java.sql.Timestamp)r.get("created_at")).toInstant(),visit((UUID)r.get("id")))).toList();return new ReceptionPage(page,rows.size()>100?page.getLast().visit().id():null);});
 }
 public record RequestInput(UUID visitId,UUID patientId,@jakarta.validation.constraints.Pattern(regexp="DOCTOR_CHANGE|SPECIALTY_CHANGE|DOCTOR_UNAVAILABLE|ROUTING_FAILURE|NO_ELIGIBLE_DOCTOR|INCORRECT_SERVICE|DUPLICATE_CHECK_IN") @jakarta.validation.constraints.NotBlank String type,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=500) String reason){}
 public record ReceptionRequest(UUID id,UUID visitId,UUID patientId,String type,String reason,String state,UUID actorUserId,Instant createdAt){}
 private ReceptionRequest requestView(java.sql.ResultSet rs)throws java.sql.SQLException{return new ReceptionRequest(rs.getObject("id",UUID.class),rs.getObject("visit_id",UUID.class),rs.getObject("patient_id",UUID.class),rs.getString("type"),rs.getString("reason"),rs.getString("state"),rs.getObject("actor_user_id",UUID.class),rs.getTimestamp("created_at").toInstant());}
 public List<ReceptionRequest> requests(Actor actor,UUID clinic,UUID branch){requireAny(actor,clinic,branch,"RECEPTION","OPERATIONS_VIEW");return local(clinic,branch,()->jdbc.query("select * from encounter_v2.reception_requests where state='OPEN' order by created_at,id",(rs,n)->requestView(rs)));}
 public ReceptionRequest request(Actor actor,UUID clinic,UUID branch,String key,RequestInput in){
  require(actor,"RECEPTION",clinic,branch);checkKey(key);String digest=hash(in);
  if(in.patientId()!=null)sources.patient(clinic,in.patientId());
  return local(clinic,branch,()->{db.lock("reception-request:"+actor.id()+":"+key);var old=jdbc.queryForList("select * from encounter_v2.reception_requests where actor_user_id=? and key=?",actor.id(),key);if(!old.isEmpty()){if(!digest.equals(old.getFirst().get("payload_hash")))throw ApiProblem.conflict("Yêu cầu đã thay đổi nội dung.");return jdbc.queryForObject("select * from encounter_v2.reception_requests where id=?",(rs,n)->requestView(rs),old.getFirst().get("id"));}
   UUID patient=in.patientId();if(in.visitId()!=null){var v=visit(in.visitId());if(patient!=null&&!patient.equals(v.patientId()))throw ApiProblem.invalid("Bệnh nhân không thuộc lượt khám.");patient=v.patientId();}
   UUID id=UUID.randomUUID();jdbc.update("insert into encounter_v2.reception_requests(id,clinic_id,branch_id,visit_id,patient_id,type,reason,actor_user_id,key,payload_hash) values(?,?,?,?,?,?,?,?,?,?)",id,clinic,branch,in.visitId(),patient,in.type(),in.reason().trim(),actor.id(),key,digest);
   if(in.visitId()!=null){history(actor,clinic,branch,in.visitId(),"RECEPTION_REQUESTED",in.reason(),null,null);emit(actor,clinic,branch,in.visitId(),"clinic.encounter.reception_requested.v1");}
   return jdbc.queryForObject("select * from encounter_v2.reception_requests where id=?",(rs,n)->requestView(rs),id);
  });
 }
 public ReceptionRequest resolveRequest(Actor actor,UUID clinic,UUID branch,UUID id,String reason){requireManager(actor,clinic,branch);if(reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("Cần lý do xử lý.");return local(clinic,branch,()->{var rows=jdbc.queryForList("select * from encounter_v2.reception_requests where id=? for update",id);if(rows.isEmpty())throw ApiProblem.missing();jdbc.update("update encounter_v2.reception_requests set state='RESOLVED',resolved_by=?,resolved_at=now(),resolution=? where id=? and state='OPEN'",actor.id(),reason.trim(),id);return jdbc.queryForObject("select * from encounter_v2.reception_requests where id=?",(rs,n)->requestView(rs),id);});}

 public List<ArrivalRecovery> arrivals(Actor actor,UUID clinic,UUID branch,LocalDate date){
  require(actor,"RECEPTION",clinic,branch);var zone=ZoneId.of("Asia/Ho_Chi_Minh");var start=java.sql.Timestamp.from(date.atStartOfDay(zone).toInstant());var end=java.sql.Timestamp.from(date.plusDays(1).atStartOfDay(zone).toInstant());
  return local(clinic,branch,()->jdbc.queryForList("select distinct on (visit_id) visit_id,operation,created_at from encounter_v2.command_receipts where actor_user_id=? and created_at>=? and created_at<? order by visit_id,created_at desc limit 100",actor.id(),start,end).stream().map(row->new ArrivalRecovery((String)row.get("operation"),((java.sql.Timestamp)row.get("created_at")).toInstant(),visit((UUID)row.get("visit_id")))).toList());
 }
 public VisitView recoverArrival(Actor actor,UUID clinic,UUID branch,UUID id,QueueInput input){
  require(actor,"RECEPTION",clinic,branch);clinics.requireBranch(clinic,branch);
  var original=local(clinic,branch,()->{var receipts=jdbc.queryForList("select operation,arrival_reason from encounter_v2.command_receipts where actor_user_id=? and visit_id=? order by created_at limit 1",actor.id(),id);if(receipts.isEmpty())throw ApiProblem.missing();return visit(id);});
  if(!"ARRIVAL_PENDING".equals(original.status()))return original;
  if(original.version()!=input.expectedVersion()||original.appointmentId()==null)throw ApiProblem.conflict("Arrival changed; reload");
  var booking=sources.booking(clinic,branch,original.appointmentId());
  if(!original.patientId().equals(booking.patientId())||!original.clinicPatientLinkId().equals(booking.clinicPatientLinkId())||!original.doctorId().equals(booking.doctorId()))throw ApiProblem.conflict("Arrival source changed");
  if(!Set.of("CONFIRMED","CHECKED_IN").contains(booking.status()))throw ApiProblem.conflict("Appointment cannot be recovered");
  if("CONFIRMED".equals(booking.status())){var link=sources.patient(clinic,original.patientId());if(!original.clinicPatientLinkId().equals(link.id()))throw ApiProblem.conflict("Patient link changed");sources.doctor(clinic,branch,original.doctorId());}
  sources.claim(clinic,branch,booking.id(),original.patientId(),id,actor.id(),booking.version());
  return local(clinic,branch,()->{db.lock("visit:"+id);var current=visit(id);if(!"ARRIVAL_PENDING".equals(current.status()))return current;
   var receipt=jdbc.queryForMap("select arrival_reason from encounter_v2.command_receipts where actor_user_id=? and visit_id=? order by created_at limit 1",actor.id(),id);String reason=(String)receipt.get("arrival_reason");if(reason==null)reason=input.reason();
   UUID point=jdbc.queryForObject("select service_point_id from encounter_v2.visits where id=?",UUID.class,id);jdbc.update("update encounter_v2.visits set status='WAITING',row_version=row_version+1 where id=?",id);activate(actor,clinic,branch,id,point,reason);history(actor,clinic,branch,id,"ARRIVAL_RECOVERED",input.reason(),"ARRIVAL_PENDING","WAITING");return visit(id);
  });
 }
 private void requireManager(Actor actor,UUID clinic,UUID branch){require(actor,"OPERATIONS_MANAGE",clinic,branch);}
 public record PendingPage(List<VisitView> items,UUID nextAfter){}
 public PendingPage pending(Actor actor,UUID clinic,UUID branch,UUID after,int limit){requireManager(actor,clinic,branch);if(limit<1||limit>100)throw ApiProblem.invalid("Page size must be between 1 and 100");return local(clinic,branch,()->{var ids=jdbc.queryForList("select id from encounter_v2.visits where status='ARRIVAL_PENDING' and id>? order by id limit ?",UUID.class,after==null?new UUID(0,0):after,limit+1);boolean more=ids.size()>limit;var page=ids.stream().limit(limit).map(this::visit).toList();return new PendingPage(page,more?page.getLast().id():null);});}
 public VisitView superviseArrival(Actor actor,UUID clinic,UUID branch,UUID id,String key,QueueInput input){
  requireManager(actor,clinic,branch);clinics.requireBranch(clinic,branch);checkKey(key);if(input.reason()==null||input.reason().isBlank()||input.reason().length()>500||input.expectedVersion()<0||input.destinationPointId()!=null)throw ApiProblem.invalid("Recovery requires original version, point and bounded reason");String digest=hash(List.of(id,input));
  var reserved=local(clinic,branch,()->{db.lock("supervisor-arrival:"+clinic+":"+branch+":"+actor.id()+":"+key);db.lock("visit:"+id);var current=visit(id);UUID replay=receipt(actor,clinic,branch,"supervisor-arrival",key,digest);if(replay!=null){if(!id.equals(replay))throw ApiProblem.conflict("Recovery target changed");return current;}
   if(!"ARRIVAL_PENDING".equals(current.status())||current.appointmentId()==null||current.version()!=input.expectedVersion())throw ApiProblem.conflict("Only the unchanged pending arrival can be recovered");UUID point=jdbc.queryForObject("select service_point_id from encounter_v2.visits where id=?",UUID.class,id);requirePoint(point);receiptInsert(actor,clinic,branch,"supervisor-arrival",key,digest,id,point,input.reason());return current;
  });
  if(!"ARRIVAL_PENDING".equals(reserved.status()))return reserved;
  var booking=sources.booking(clinic,branch,reserved.appointmentId());if(!reserved.patientId().equals(booking.patientId())||!reserved.clinicPatientLinkId().equals(booking.clinicPatientLinkId())||!reserved.doctorId().equals(booking.doctorId())||!Set.of("CONFIRMED","CHECKED_IN").contains(booking.status()))throw ApiProblem.conflict("Pending arrival source changed");
  if("CONFIRMED".equals(booking.status())){var link=sources.patient(clinic,reserved.patientId());if(!link.id().equals(reserved.clinicPatientLinkId()))throw ApiProblem.conflict("Patient link changed");sources.doctor(clinic,branch,reserved.doctorId());}
  sources.claim(clinic,branch,booking.id(),reserved.patientId(),id,actor.id(),booking.version());
  return local(clinic,branch,()->{db.lock("visit:"+id);var current=visit(id);if(!"ARRIVAL_PENDING".equals(current.status()))return current;UUID point=jdbc.queryForObject("select service_point_id from encounter_v2.visits where id=?",UUID.class,id);requirePoint(point);jdbc.update("update encounter_v2.visits set status='WAITING',row_version=row_version+1 where id=?",id);activate(actor,clinic,branch,id,point,input.reason());history(actor,clinic,branch,id,"SUPERVISOR_ARRIVAL_RECOVERY",input.reason(),"ARRIVAL_PENDING","WAITING");emit(actor,clinic,branch,id,"clinic.encounter.arrival_recovered.v1");return visit(id);});
 }
 public record QueuePage(List<TicketView> items,Integer nextAfterNumber){}
 public QueuePage queuePage(Actor actor,UUID clinic,UUID branch,UUID point,LocalDate date,int afterNumber,int limit){require(actor,"RECEPTION",clinic,branch);if(afterNumber<0||limit<1||limit>100)throw ApiProblem.invalid("Invalid queue page");return local(clinic,branch,()->{requirePoint(point);var rows=jdbc.query("select * from encounter_v2.queue_tickets where service_point_id=? and queue_date=? and number>? order by number limit ?",(rs,n)->ticketView(rs),point,date,afterNumber,limit+1);boolean more=rows.size()>limit;var page=rows.stream().limit(limit).toList();return new QueuePage(page,more?page.getLast().number():null);});}
 public TicketView rollForward(Actor actor,UUID clinic,UUID branch,UUID id,String key,QueueInput input){
  require(actor,"RECEPTION",clinic,branch);clinics.requireBranch(clinic,branch);checkKey(key);if(input.reason()==null||input.reason().isBlank()||input.reason().length()>500||input.expectedVersion()<0)throw ApiProblem.invalid("Version and bounded reason are required");String digest=hash(List.of(id,input));
  var acknowledged=local(clinic,branch,()->{UUID replay=receipt(actor,clinic,branch,"queue-roll-forward",key,digest);if(replay==null)return null;var current=visit(replay);if(current.ticket()==null)throw ApiProblem.conflict("Queue already completed; inspect its visit history");return current.ticket();});if(acknowledged!=null)return acknowledged;
  var source=local(clinic,branch,()->{var rows=jdbc.queryForList("select visit_id from encounter_v2.queue_tickets where id=?",UUID.class,id);if(rows.isEmpty())throw ApiProblem.missing();return visit(rows.getFirst());});sources.doctor(clinic,branch,source.doctorId());
  return local(clinic,branch,()->{db.lock("roll-forward:"+clinic+":"+branch+":"+actor.id()+":"+key);db.lock("visit:"+source.id());UUID replay=receipt(actor,clinic,branch,"queue-roll-forward",key,digest);if(replay!=null){var current=visit(replay);if(current.ticket()==null)throw ApiProblem.conflict("Queue already completed; inspect its visit history");return current.ticket();}
   var original=jdbc.queryForObject("select * from encounter_v2.queue_tickets where id=? for update",(rs,n)->ticketView(rs),id);var current=visit(source.id());
   if(original.version()!=input.expectedVersion()||!original.date().isBefore(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))||!Set.of("WAITING","CALLED","SKIPPED").contains(original.state())||!"WAITING".equals(current.status()))throw ApiProblem.conflict("Only an unresolved waiting visit from a prior date can return to today's queue");
   if(current.ticket()!=null&&!current.ticket().id().equals(id))throw ApiProblem.conflict("Visit already has another active ticket");UUID point=input.destinationPointId()==null?original.servicePointId():input.destinationPointId();requirePoint(point);
   jdbc.update("update encounter_v2.queue_tickets set state='TRANSFERRED',row_version=row_version+1 where id=?",id);ticket(clinic,branch,current.id(),point);jdbc.update("update encounter_v2.visits set service_point_id=?,row_version=row_version+1 where id=?",point,current.id());receiptInsert(actor,clinic,branch,"queue-roll-forward",key,digest,current.id(),point,input.reason());history(actor,clinic,branch,current.id(),"QUEUE_ROLLED_FORWARD",input.reason(),original.state(),"WAITING");emit(actor,clinic,branch,current.id(),"clinic.encounter.queue_changed.v1");return visit(current.id()).ticket();
  });
 }
 public record WorklistPage(List<VisitView> items,UUID nextAfter){}
 public List<VisitView> worklist(Actor actor,UUID clinic,UUID branch){return worklistPage(actor,clinic,branch,null,200).items();}
 public WorklistPage worklistPage(Actor actor,UUID clinic,UUID branch,UUID after,int limit){
  requireDoctor(actor,clinic,branch);if(limit<1||limit>200)throw ApiProblem.invalid("Page size must be between 1 and 200");
  return local(clinic,branch,()->{
   String query="select id from encounter_v2.visits where doctor_user_id=? and status in ('WAITING','IN_PROGRESS','AWAITING_RESULTS','CLINICALLY_COMPLETED')";
   var args=new ArrayList<Object>();args.add(actor.id());
   if(after!=null){
    var cursor=jdbc.query("select created_at from encounter_v2.visits where id=? and doctor_user_id=?",(rs,n)->rs.getTimestamp(1),after,actor.id());
    if(cursor.isEmpty())throw ApiProblem.conflict("Reload the worklist: cursor is no longer available in this scope");
    query+=" and (created_at,id)>(?,?)";args.add(cursor.getFirst());args.add(after);
   }
   args.add(limit+1);var ids=jdbc.queryForList(query+" order by created_at,id limit ?",UUID.class,args.toArray());
   var page=ids.stream().limit(limit).map(this::visit).toList();return new WorklistPage(page,ids.size()>limit?page.getLast().id():null);
  });
 }
 public VisitView doctorRead(Actor actor,UUID clinic,UUID branch,UUID id){requireDoctor(actor,clinic,branch);return local(clinic,branch,()->{var v=visit(id);UUID assigned=jdbc.queryForObject("select doctor_user_id from encounter_v2.visits where id=?",UUID.class,id);if(!actor.id().equals(assigned))throw ApiProblem.forbidden();return v;});}
 public List<VisitView> doctorIdentities(Actor actor,UUID clinic,UUID branch,List<UUID> ids){
  requireDoctor(actor,clinic,branch);if(ids==null||ids.isEmpty()||ids.size()>200||ids.stream().anyMatch(Objects::isNull))throw ApiProblem.invalid("Use 1 to 200 visit references");
  return local(clinic,branch,()->{var unique=ids.stream().distinct().toList();var args=new ArrayList<Object>();args.add(actor.id());args.addAll(unique);return jdbc.queryForList("select id from encounter_v2.visits where doctor_user_id=? and id in ("+String.join(",",Collections.nCopies(unique.size(),"?"))+")",UUID.class,args.toArray()).stream().map(this::visit).toList();});
 }
 private void requireDoctor(Actor actor,UUID clinic,UUID branch){if(actor==null)throw ApiProblem.forbidden();var decision=iam.decide(actor.id(),"DOCTOR_WORK",clinic,branch);if(!decision.allowed()||!"DOCTOR".equals(decision.role()))throw ApiProblem.forbidden();}
 public List<PointView> carePoints(Actor actor,UUID clinic,UUID branch){requireDoctor(actor,clinic,branch);return local(clinic,branch,()->jdbc.query("select * from encounter_v2.service_points where active order by code",(rs,n)->new PointView(rs.getObject("id",UUID.class),rs.getString("code"),rs.getString("name"),rs.getBoolean("active"))));}
 public VisitView care(Actor actor,UUID clinic,UUID branch,UUID id,String action,String key,CareInput in){
  requireDoctor(actor,clinic,branch);checkKey(key);
  if(!Set.of("call","start","await-results","resume-queue").contains(action)||in.expectedVersion()<0||in.reason()==null||in.reason().isBlank()||in.reason().length()>500)throw ApiProblem.invalid("Invalid care command");
  if(!"resume-queue".equals(action)&&in.servicePointId()!=null)throw ApiProblem.invalid("Service point applies only to resume queue");
  String digest=hash(List.of(id,action,in));
  return local(clinic,branch,()->{
   db.lock("care-command:"+clinic+":"+branch+":"+actor.id()+":"+action+":"+key);
   db.lock("visit:"+id);var v=visit(id);
   UUID assigned=jdbc.queryForObject("select doctor_user_id from encounter_v2.visits where id=? for update",UUID.class,id);
   if(!actor.id().equals(assigned))throw ApiProblem.forbidden();
   var previous=jdbc.queryForList("select visit_id,payload_hash from encounter_v2.care_commands where actor_user_id=? and operation=? and key=?",actor.id(),action,key);
   if(!previous.isEmpty()){var p=previous.getFirst();if(!id.equals(p.get("visit_id"))||!digest.equals(p.get("payload_hash")))throw new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","Care key was used with different data");return v;}
   if(v.version()!=in.expectedVersion())throw ApiProblem.conflict("Visit changed; reload");
   if("call".equals(action))callCare(actor,clinic,branch,v,in.reason());
   else if("start".equals(action))startCare(actor,clinic,branch,v,in.reason());
   else if("await-results".equals(action)){
    if(!"IN_PROGRESS".equals(v.status())||v.ticket()==null||!"SERVING".equals(v.ticket().state()))throw ApiProblem.conflict("Only a serving encounter can wait for results");
    jdbc.update("update encounter_v2.queue_tickets set state='DONE',row_version=row_version+1 where id=?",v.ticket().id());
    jdbc.update("update encounter_v2.visits set status='AWAITING_RESULTS',row_version=row_version+1 where id=?",id);
    history(actor,clinic,branch,id,"AWAITING_RESULTS",in.reason(),v.status(),"AWAITING_RESULTS");emit(actor,clinic,branch,id,"clinic.encounter.awaiting_results.v1");
   }else{
    if(!"AWAITING_RESULTS".equals(v.status())||v.ticket()!=null)throw ApiProblem.conflict("Only an awaiting-results encounter without an active ticket can return to queue");
    UUID point=in.servicePointId()!=null?in.servicePointId():jdbc.queryForObject("select service_point_id from encounter_v2.visits where id=?",UUID.class,id);
    ticket(clinic,branch,id,point);
    jdbc.update("update encounter_v2.visits set service_point_id=?,row_version=row_version+1 where id=?",point,id);
    history(actor,clinic,branch,id,"RETURN_QUEUED",in.reason(),v.status(),v.status());emit(actor,clinic,branch,id,"clinic.encounter.return_queued.v1");
   }
   jdbc.update("insert into encounter_v2.care_commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,visit_id) values(?,?,?,?,?,?,?)",clinic,branch,actor.id(),action,key,digest,id);return visit(id);
  });
 }
 private void callCare(Actor actor,UUID clinic,UUID branch,VisitView v,String reason){
  if(!Set.of("WAITING","AWAITING_RESULTS").contains(v.status())||v.ticket()==null||!"WAITING".equals(v.ticket().state())||!v.ticket().date().equals(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))throw ApiProblem.conflict("Visit must have a waiting ticket for the current local date");
  db.lock("doctor-call:"+actor.id()+":"+v.ticket().date());
  db.lock("queue-doctor-point:"+v.doctorId()+":"+v.ticket().servicePointId()+":"+v.ticket().date());
  db.lock("queue:"+v.ticket().servicePointId()+":"+v.ticket().date());
  if(jdbc.queryForObject("select count(*) from encounter_v2.queue_tickets t join encounter_v2.visits v on v.id=t.visit_id where v.doctor_user_id=? and t.service_point_id=? and t.queue_date=? and t.state in ('CALLED','SERVING')",Integer.class,actor.id(),v.ticket().servicePointId(),v.ticket().date())>0)throw ApiProblem.conflict("Finish the currently called or serving patient first");
  Integer first=jdbc.queryForObject("select min(t.number) from encounter_v2.queue_tickets t join encounter_v2.visits v on v.id=t.visit_id where v.doctor_user_id=? and t.service_point_id=? and t.queue_date=? and t.state='WAITING'",Integer.class,actor.id(),v.ticket().servicePointId(),v.ticket().date());
  if(first==null||first!=v.ticket().number())throw ApiProblem.conflict("An earlier patient is still waiting in this queue");
  jdbc.update("update encounter_v2.queue_tickets set state='CALLED',row_version=row_version+1 where id=?",v.ticket().id());
  jdbc.update("update encounter_v2.visits set row_version=row_version+1 where id=?",v.id());
  history(actor,clinic,branch,v.id(),"QUEUE_CALLED",reason,v.status(),v.status());emit(actor,clinic,branch,v.id(),"clinic.encounter.queue_changed.v1");
 }
 private VisitView lockedAssigned(Actor actor,UUID id){db.lock("visit:"+id);var v=visit(id);UUID assigned=jdbc.queryForObject("select doctor_user_id from encounter_v2.visits where id=? for update",UUID.class,id);if(!actor.id().equals(assigned))throw ApiProblem.forbidden();return v;}
 private boolean careReplay(Actor actor,UUID id,String action,String key,String digest){var rows=jdbc.queryForList("select visit_id,payload_hash from encounter_v2.care_commands where actor_user_id=? and operation=? and key=?",actor.id(),action,key);if(rows.isEmpty())return false;var row=rows.getFirst();if(!id.equals(row.get("visit_id"))||!digest.equals(row.get("payload_hash")))throw new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","Care key payload changed");return true;}
 private void careReceipt(Actor actor,UUID clinic,UUID branch,UUID id,String action,String key,String digest){jdbc.update("insert into encounter_v2.care_commands(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,visit_id) values(?,?,?,?,?,?,?)",clinic,branch,actor.id(),action,key,digest,id);}
 public VisitView complete(Actor actor,UUID clinic,UUID branch,UUID id,String key,CompletionInput in){
  requireDoctor(actor,clinic,branch);checkKey(key);if(in.expectedVersion()<0||in.medicalCaseVersion()<1||in.reason()==null||in.reason().isBlank()||in.reason().length()>500)throw ApiProblem.invalid("Invalid completion command");
  String digest=hash(List.of(id,in));
  VisitView replay=local(clinic,branch,()->{var v=lockedAssigned(actor,id);return careReplay(actor,id,"complete",key,digest)?v:null;});if(replay!=null)return replay;
  // VALIDATED Medical cases are immutable in this delivery scope. Read proof before starting the local write transaction.
  var proof=medical.read(actor,clinic,branch,id);
  if(proof==null||!id.equals(proof.encounterId())||!clinic.equals(proof.clinicId())||!branch.equals(proof.branchId())||!proof.ready()||!"VALIDATED".equals(proof.status())||proof.caseVersion()!=in.medicalCaseVersion())throw ApiProblem.conflict("Current validated Medical proof required");
  return local(clinic,branch,()->{
   db.lock("care-command:"+clinic+":"+branch+":"+actor.id()+":complete:"+key);var v=lockedAssigned(actor,id);if(careReplay(actor,id,"complete",key,digest))return v;
   if(v.version()!=in.expectedVersion()||!"IN_PROGRESS".equals(v.status())||v.ticket()==null||!"SERVING".equals(v.ticket().state()))throw ApiProblem.conflict("Only the current serving encounter can complete");
   if(v.consultation()!=null&&!in.consultationConfirmed())throw ApiProblem.conflict("Xem lại và xác nhận dịch vụ khám đã thực hiện trước khi hoàn tất.");
   if(v.consultation()!=null)jdbc.update("update encounter_v2.visits set consultation_performed_at=now() where id=?",id);
   jdbc.update("update encounter_v2.queue_tickets set state='DONE',row_version=row_version+1 where id=?",v.ticket().id());
   jdbc.update("update encounter_v2.visits set status='CLINICALLY_COMPLETED',clinically_completed_at=now(),medical_case_version=?,row_version=row_version+1 where id=?",proof.caseVersion(),id);
   history(actor,clinic,branch,id,"CLINICALLY_COMPLETED",in.reason(),v.status(),"CLINICALLY_COMPLETED");careReceipt(actor,clinic,branch,id,"complete",key,digest);emit(actor,clinic,branch,id,"clinic.encounter.clinically_completed.v1");return visit(id);
  });
 }
 public VisitView close(Actor actor,UUID clinic,UUID branch,UUID id,String key,ClosureInput in){
  requireDoctor(actor,clinic,branch);checkKey(key);if(in.expectedVersion()<0||in.reason()==null||in.reason().isBlank()||in.reason().length()>500)throw ApiProblem.invalid("Invalid closure command");String digest=hash(List.of(id,in));
  return local(clinic,branch,()->{db.lock("care-command:"+clinic+":"+branch+":"+actor.id()+":close:"+key);var v=lockedAssigned(actor,id);if(careReplay(actor,id,"close",key,digest))return v;
   if(v.version()!=in.expectedVersion()||!"CLINICALLY_COMPLETED".equals(v.status())||v.ticket()!=null)throw ApiProblem.conflict("Only a clinically completed encounter can close");
   jdbc.update("update encounter_v2.visits set status='CLOSED',closed_at=now(),row_version=row_version+1 where id=?",id);history(actor,clinic,branch,id,"CLOSED",in.reason(),v.status(),"CLOSED");careReceipt(actor,clinic,branch,id,"close",key,digest);emit(actor,clinic,branch,id,"clinic.encounter.closed.v1");return visit(id);
  });
 }
 private void startCare(Actor actor,UUID clinic,UUID branch,VisitView v,String reason){
  if(!Set.of("WAITING","AWAITING_RESULTS").contains(v.status())||v.ticket()==null||!"CALLED".equals(v.ticket().state())||!v.ticket().date().equals(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))throw ApiProblem.conflict("Visit must have a called ticket for the current local date");
  db.lock("doctor-active:"+actor.id());
  if(jdbc.queryForObject("select count(*) from encounter_v2.visits where doctor_user_id=? and status='IN_PROGRESS' and id<>?",Integer.class,actor.id(),v.id())>0)throw ApiProblem.conflict("Bác sĩ đang có một lượt khám khác. Hãy hoàn tất hoặc chuyển lượt đó sang chờ kết quả trước.");
  jdbc.update("update encounter_v2.queue_tickets set state='SERVING',row_version=row_version+1 where id=?",v.ticket().id());
  try{jdbc.update("update encounter_v2.visits set status='IN_PROGRESS',row_version=row_version+1 where id=?",v.id());}
  catch(org.springframework.dao.DataIntegrityViolationException ex){throw ApiProblem.conflict("Bác sĩ đang có một lượt khám khác. Hãy tải lại hàng đợi.");}
  history(actor,clinic,branch,v.id(),"AWAITING_RESULTS".equals(v.status())?"CARE_RESUMED":"CARE_STARTED",reason,v.status(),"IN_PROGRESS");emit(actor,clinic,branch,v.id(),"clinic.encounter.started.v1");
 }
 public VisitView start(Actor actor,UUID clinic,UUID branch,UUID id,QueueInput in){requireDoctor(actor,clinic,branch);return local(clinic,branch,()->{
  db.lock("visit:"+id);var row=jdbc.queryForMap("select * from encounter_v2.visits where id=? for update",id);
  if(!actor.id().equals(row.get("doctor_user_id")))throw ApiProblem.forbidden();var v=visit(id);if(v.version()!=in.expectedVersion())throw ApiProblem.conflict("Visit changed; reload");
  startCare(actor,clinic,branch,v,in.reason());return visit(id);
 });}
 private UUID receipt(Actor actor,UUID clinic,UUID branch,String operation,String key,String hash){var rows=jdbc.queryForList("select visit_id,payload_hash from encounter_v2.command_receipts where actor_user_id=? and operation=? and key=?",actor.id(),operation,key);if(rows.isEmpty())return null;var row=rows.getFirst();if(!hash.equals(row.get("payload_hash")))throw new ApiProblem(org.springframework.http.HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT","Key was used with different arrival data");return (UUID)row.get("visit_id");}
 private void receiptInsert(Actor actor,UUID clinic,UUID branch,String operation,String key,String hash,UUID visit,UUID point,String reason){jdbc.update("insert into encounter_v2.command_receipts(clinic_id,branch_id,actor_user_id,operation,key,payload_hash,visit_id,service_point_id,arrival_reason) values(?,?,?,?,?,?,?,?,?)",clinic,branch,actor.id(),operation,key,hash,visit,point,reason);}
 private VisitView visit(UUID id){var rows=jdbc.queryForList("select * from encounter_v2.visits where id=?",id);if(rows.isEmpty())throw ApiProblem.missing();var r=rows.getFirst();var tickets=jdbc.query("select * from encounter_v2.queue_tickets where visit_id=? and state in ('WAITING','CALLED','SERVING')",(rs,n)->ticketView(rs),id);return new VisitView(id,(UUID)r.get("clinic_id"),(UUID)r.get("branch_id"),(UUID)r.get("patient_id"),(UUID)r.get("clinic_patient_link_id"),(UUID)r.get("appointment_id"),(UUID)r.get("doctor_id"),(String)r.get("status"),r.get("checked_in_at")==null?null:((java.sql.Timestamp)r.get("checked_in_at")).toInstant(),((Number)r.get("row_version")).longValue(),tickets.isEmpty()?null:tickets.getFirst(),null,consultation(r.get("consultation_json")),r.get("consultation_performed_at")==null?null:((java.sql.Timestamp)r.get("consultation_performed_at")).toInstant());}
 private TicketView ticketView(java.sql.ResultSet rs)throws java.sql.SQLException{return new TicketView(rs.getObject("id",UUID.class),rs.getObject("visit_id",UUID.class),rs.getObject("service_point_id",UUID.class),rs.getObject("queue_date",LocalDate.class),rs.getInt("number"),rs.getString("code"),rs.getString("state"),rs.getLong("row_version")).withIssuedAt(rs.getTimestamp("created_at").toInstant());}
 private void history(Actor actor,UUID clinic,UUID branch,UUID visit,String action,String reason,String from,String to){if(reason==null||reason.isBlank()||reason.length()>500)throw ApiProblem.invalid("A bounded reason is required");jdbc.update("insert into encounter_v2.visit_history(id,clinic_id,branch_id,visit_id,actor_user_id,action,reason,from_state,to_state) values(?,?,?,?,?,?,?,?,?)",UUID.randomUUID(),clinic,branch,visit,actor.id(),action,reason.trim(),from,to);}
 private void emit(Actor actor,UUID clinic,UUID branch,UUID visit,String type){var v=visit(visit);UUID event=UUID.randomUUID();Map<String,Object> envelope=new LinkedHashMap<>();envelope.put("specversion","1.0");envelope.put("id",event.toString());envelope.put("source","/services/encounter");envelope.put("type",type);envelope.put("subject","encounter/"+visit);envelope.put("time",Instant.now().toString());envelope.put("datacontenttype","application/json");envelope.put("clinicid",clinic.toString());envelope.put("branchid",branch.toString());envelope.put("correlationid",UUID.randomUUID().toString());envelope.put("aggregateversion",v.version());envelope.put("data",Map.of("encounterId",visit.toString(),"patientRef",v.patientId().toString(),"actorUserId",actor.id().toString(),"status",v.status()));try{jdbc.update("insert into encounter_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",event,clinic,branch,visit,type,json.writeValueAsString(envelope));if("clinic.encounter.clinically_completed.v1".equals(type)&&v.appointmentId()!=null)jdbc.update("insert into encounter_v2.appointment_deliveries(event_id,clinic_id,branch_id,appointment_id,encounter_id,actor_user_id) values(?,?,?,?,?,?)",event,clinic,branch,v.appointmentId(),visit,actor.id());}catch(com.fasterxml.jackson.core.JsonProcessingException ex){throw new IllegalStateException(ex);}}
 private Consultation consultation(Object raw){if(raw==null)return null;try{return json.readValue(raw.toString(),Consultation.class);}catch(Exception e){throw new IllegalStateException("Invalid consultation snapshot",e);}}
 private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 private String hash(Object body){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body)));}catch(Exception ex){throw new IllegalStateException(ex);}}
 private void checkKey(String key){if(key==null||key.isBlank()||key.length()>120)throw ApiProblem.invalid("Idempotency-Key is required");}
}
