package com.clinic.encounter.service;
import com.clinic.encounter.api.ApiProblem;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
@Component
public class EncounterSources {
 private final RestClient patient,doctor,appointment,catalog;private final javax.crypto.SecretKey key;
 public EncounterSources(@Value("${encounter.patient-url:http://127.0.0.1:8098}") String patientUrl,@Value("${encounter.doctor-url:http://127.0.0.1:8094}") String doctorUrl,@Value("${encounter.appointment-url:http://127.0.0.1:8099}") String appointmentUrl,@Value("${encounter.catalog-url:http://127.0.0.1:8095}") String catalogUrl,@Value("${encounter.security.service-secret}") String secret){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  patient=RestClient.builder().baseUrl(patientUrl).requestFactory(f).build();doctor=RestClient.builder().baseUrl(doctorUrl).requestFactory(f).build();appointment=RestClient.builder().baseUrl(appointmentUrl).requestFactory(f).build();
  catalog=RestClient.builder().baseUrl(catalogUrl).requestFactory(f).build();
  key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
 }
 private String bearer(String audience,String scope){var now=Instant.now();return "Bearer "+Jwts.builder().issuer("encounter-service").subject("encounter-service").audience().add(audience).and().id(UUID.randomUUID().toString()).claim("token_type","workload").claim("scopes",List.of(scope)).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(30))).signWith(key).compact();}
 public record CatalogOffering(UUID id,String name,boolean active,String specialtyCode){}
 public record BranchOffering(UUID clinicId,UUID branchId,CatalogOffering offering,boolean active){}
 public record CatalogPrice(UUID priceVersionId,UUID clinicId,UUID branchId,UUID offeringId,long amountVnd,String currency,String taxPolicyCode,String discountPolicyCode,Instant effectiveFrom){}
 public com.clinic.encounter.api.EncounterDto.Consultation consultation(com.clinic.encounter.security.Actor actor,UUID clinic,UUID branch,UUID offering){
  if(offering==null)throw ApiProblem.invalid("Chọn dịch vụ khám từ bảng giá trước khi tiếp nhận.");
  try{
   var rows=catalog.get().uri("/api/clinics/{c}/branches/{b}/offerings",clinic,branch).header(HttpHeaders.AUTHORIZATION,actor.bearer()).retrieve().body(BranchOffering[].class);
   var selected=Arrays.stream(rows==null?new BranchOffering[0]:rows).filter(o->clinic.equals(o.clinicId())&&branch.equals(o.branchId())&&o.active()&&o.offering()!=null&&o.offering().active()&&offering.equals(o.offering().id())).findFirst().orElseThrow(()->ApiProblem.conflict("Dịch vụ không còn được cung cấp. Tải lại bảng giá."));
   var p=catalog.get().uri("/api/clinics/{c}/branches/{b}/offerings/{id}/price-snapshot",clinic,branch,offering).header(HttpHeaders.AUTHORIZATION,actor.bearer()).retrieve().body(CatalogPrice.class);
   if(p==null||!clinic.equals(p.clinicId())||!branch.equals(p.branchId())||!offering.equals(p.offeringId())||p.priceVersionId()==null||p.amountVnd()<0||p.amountVnd()>9000000000000L||!"VND".equals(p.currency())||p.effectiveFrom()==null||p.effectiveFrom().isAfter(Instant.now()))throw ApiProblem.conflict("Dịch vụ chưa có giá hợp lệ để tiếp nhận.");
   return new com.clinic.encounter.api.EncounterDto.Consultation(offering,selected.offering().name(),new com.clinic.encounter.api.EncounterDto.PriceSnapshot(p.priceVersionId(),p.amountVnd(),p.currency(),p.effectiveFrom(),p.taxPolicyCode(),p.discountPolicyCode()));
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Chưa đối chiếu được dịch vụ và giá khám. Vui lòng thử lại.");}
 }
 public PatientLink patient(UUID clinic,UUID patientId){
  try{var p=patient.get().uri("/api/internal/clinics/{clinic}/patients/{patient}",clinic,patientId).header(HttpHeaders.AUTHORIZATION,bearer("patient-service","patient.clinic.read")).retrieve().body(PatientLink.class);
   if(p==null||!clinic.equals(p.clinicId())||!patientId.equals(p.patientId())||p.id()==null||!Set.of("VERIFIED","PROVISIONAL").contains(p.status()))throw ApiProblem.invalid("Patient clinic link is not usable");return p;
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Patient verification unavailable");}
 }
 public DoctorAssignment doctor(UUID clinic,UUID branch,UUID id){
  try{var d=doctor.get().uri("/api/internal/clinics/{clinic}/branches/{branch}/doctors/{id}/assignment",clinic,branch,id).header(HttpHeaders.AUTHORIZATION,bearer("doctor-service","doctor.assignment.read")).retrieve().body(DoctorAssignment.class);
   if(d==null||!clinic.equals(d.clinicId())||!branch.equals(d.branchId())||!id.equals(d.doctorId())||d.userId()==null)throw ApiProblem.invalid("Doctor assignment invalid");return d;
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Doctor verification unavailable");}
 }
 public Booking booking(UUID clinic,UUID branch,UUID id){
  try{var a=appointment.get().uri("/api/internal/clinics/{clinic}/branches/{branch}/appointments/{id}",clinic,branch,id).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).retrieve().body(Booking.class);
   if(a==null||!clinic.equals(a.clinicId())||!branch.equals(a.branchId())||!id.equals(a.id()))throw ApiProblem.invalid("Appointment scope invalid");return a;
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Appointment verification unavailable");}
 }
 public Booking claim(UUID clinic,UUID branch,UUID id,UUID patientId,UUID visitId,UUID actor,long version){
  try{var a=appointment.post().uri("/api/internal/clinics/{clinic}/branches/{branch}/appointments/{id}/arrival",clinic,branch,id).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).contentType(MediaType.APPLICATION_JSON).body(new Arrival(patientId,visitId,actor,version)).retrieve().body(Booking.class);
   if(a==null||!id.equals(a.id())||!clinic.equals(a.clinicId())||!branch.equals(a.branchId())||!patientId.equals(a.patientId())||!visitId.equals(a.encounterId())||!"CHECKED_IN".equals(a.status()))throw ApiProblem.conflict("Arrival acknowledgement invalid");return a;
  }catch(ApiProblem ex){throw ex;}catch(org.springframework.web.client.HttpClientErrorException ex){throw ApiProblem.conflict("Appointment arrival was rejected; reload before retry");}catch(Exception ex){throw ApiProblem.dependency("Arrival outcome uncertain; retry the same key");}
 }
 public Booking fulfill(UUID clinic,UUID branch,UUID id,UUID eventId,UUID encounterId,UUID actor){
  try{var a=appointment.post().uri("/api/internal/clinics/{c}/branches/{b}/appointments/{id}/fulfillment",clinic,branch,id).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.fulfill")).contentType(MediaType.APPLICATION_JSON).body(Map.of("eventId",eventId,"encounterId",encounterId,"actorUserId",actor)).retrieve().body(Booking.class);
   if(a==null||!id.equals(a.id())||!clinic.equals(a.clinicId())||!branch.equals(a.branchId())||!encounterId.equals(a.encounterId())||!"FULFILLED".equals(a.status()))throw ApiProblem.conflict("Fulfillment acknowledgement mismatch");return a;
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Fulfillment acknowledgement unavailable");}
 }
 public record PatientLink(UUID id,UUID clinicId,UUID patientId,String status){}
 public List<com.clinic.encounter.api.EncounterDto.PatientSummary> identities(UUID clinic,List<UUID> ids){
  if(ids.isEmpty())return List.of();if(ids.size()>200)throw ApiProblem.invalid("Too many patient references");
  try{var rows=patient.post().uri("/api/internal/clinics/{c}/patient-identities",clinic).header(HttpHeaders.AUTHORIZATION,bearer("patient-service","patient.clinic.read")).contentType(MediaType.APPLICATION_JSON).body(ids).retrieve().body(com.clinic.encounter.api.EncounterDto.PatientSummary[].class);
   if(rows==null||Arrays.stream(rows).anyMatch(p->p==null||!ids.contains(p.patientId())||p.patientCode()==null||p.fullName()==null))throw ApiProblem.dependency("Patient identity response invalid");return List.of(rows);
  }catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Chưa tải được thông tin bệnh nhân. Vui lòng tải lại danh sách.");}
 }
 public record DoctorAssignment(UUID doctorId,UUID clinicId,UUID branchId,UUID userId){}
 public List<DoctorAssignment> receptionCandidates(com.clinic.encounter.security.Actor actor,UUID clinic,UUID branch,UUID offering){
  try{
   var rows=catalog.get().uri("/api/clinics/{c}/branches/{b}/offerings",clinic,branch).header(HttpHeaders.AUTHORIZATION,actor.bearer()).retrieve().body(BranchOffering[].class);
   var selected=Arrays.stream(rows==null?new BranchOffering[0]:rows).filter(o->clinic.equals(o.clinicId())&&branch.equals(o.branchId())&&o.active()&&o.offering()!=null&&o.offering().active()&&offering.equals(o.offering().id())).findFirst().orElseThrow(()->ApiProblem.invalid("Dịch vụ không còn được cung cấp."));
   if(selected.offering().specialtyCode()==null||selected.offering().specialtyCode().isBlank())throw ApiProblem.invalid("Dịch vụ chưa được cấu hình chuyên khoa để điều phối. Liên hệ quản trị.");
   var candidates=doctor.get().uri(u->u.path("/api/internal/clinics/{c}/branches/{b}/doctors/reception-candidates").queryParam("specialtyCode",selected.offering().specialtyCode()).build(clinic,branch)).header(HttpHeaders.AUTHORIZATION,bearer("doctor-service","doctor.assignment.read")).retrieve().body(DoctorAssignment[].class);
   if(candidates==null||Arrays.stream(candidates).anyMatch(d->d==null||!clinic.equals(d.clinicId())||!branch.equals(d.branchId())||d.doctorId()==null||d.userId()==null))throw ApiProblem.dependency("Nguồn điều phối bác sĩ không hợp lệ.");
   return List.of(candidates);
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.dependency("Chưa xác minh được lịch làm việc. Thử lại hoặc tạo yêu cầu xử lý.");}
 }
 public record Booking(UUID id,UUID clinicId,UUID branchId,UUID patientId,UUID clinicPatientLinkId,UUID doctorId,String status,Instant startsAt,long version,UUID encounterId){}
 public record Arrival(UUID patientId,UUID encounterId,UUID actorUserId,long expectedVersion){}
 public record ExceptionView(UUID id,UUID appointmentId,String type,String state,String notificationMode){}
 public record ExceptionInput(UUID actorUserId,long expectedVersion,String type,String reason,UUID sourceAbsenceId,UUID absenceDoctorId,Instant absenceStartsAt,Instant absenceEndsAt){public ExceptionInput(UUID actorUserId,long expectedVersion,String type,String reason){this(actorUserId,expectedVersion,type,reason,null,null,null,null);}}
 public record Absence(UUID id,UUID clinicId,UUID branchId,UUID doctorId,Instant startsAt,Instant endsAt,String state,long version){public Absence(UUID id,UUID clinicId,UUID branchId,UUID doctorId,Instant startsAt,Instant endsAt){this(id,clinicId,branchId,doctorId,startsAt,endsAt,"ACTIVE",1);}}
 public Absence absence(UUID clinic,UUID branch,UUID id){try{var a=doctor.get().uri("/api/internal/clinics/{clinic}/branches/{branch}/doctors/absences/{id}",clinic,branch,id).header(HttpHeaders.AUTHORIZATION,bearer("doctor-service","doctor.assignment.read")).retrieve().body(Absence.class);if(a==null||!id.equals(a.id())||!clinic.equals(a.clinicId())||!branch.equals(a.branchId())||a.doctorId()==null||a.startsAt()==null||a.endsAt()==null)throw ApiProblem.invalid("Absence scope invalid");return a;}catch(ApiProblem ex){throw ex;}catch(Exception ex){throw ApiProblem.dependency("Doctor absence unavailable");}}
 public List<ArrivalItem> affected(UUID clinic,UUID branch,Absence a){try{var rows=appointment.get().uri(u->u.path("/api/internal/clinics/{clinic}/branches/{branch}/absence-impact").queryParam("doctorId",a.doctorId()).queryParam("absenceId",a.id()).queryParam("startsAt",a.startsAt()).queryParam("endsAt",a.endsAt()).build(clinic,branch)).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).retrieve().body(ArrivalItem[].class);return rows==null?List.of():List.of(rows);}catch(Exception ex){throw ApiProblem.dependency("Absence impact unavailable");}}
 public List<ExceptionView> openExceptions(UUID clinic,UUID branch){try{var rows=appointment.get().uri("/api/internal/clinics/{c}/branches/{b}/reception/exceptions",clinic,branch).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).retrieve().body(ExceptionView[].class);return rows==null?List.of():List.of(rows);}catch(Exception e){throw ApiProblem.dependency("Chưa đọc được ngoại lệ lịch hẹn.");}}
 public List<ExceptionView> exceptions(UUID clinic,UUID branch,UUID appointmentId){try{var list=appointment.get().uri("/api/internal/clinics/{clinic}/branches/{branch}/appointments/{id}/exceptions",clinic,branch,appointmentId).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).retrieve().body(ExceptionView[].class);return list==null?List.of():List.of(list);}catch(Exception ex){throw ApiProblem.dependency("Appointment exceptions unavailable");}}
 public ExceptionView exception(UUID clinic,UUID branch,UUID appointmentId,String key,ExceptionInput input){try{return appointment.post().uri("/api/internal/clinics/{clinic}/branches/{branch}/appointments/{id}/exceptions",clinic,branch,appointmentId).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON).body(input).retrieve().body(ExceptionView.class);}catch(org.springframework.web.client.HttpClientErrorException ex){throw ApiProblem.conflict("Exception rejected; reload before retry");}catch(Exception ex){throw ApiProblem.dependency("Exception outcome uncertain; retry the same key");}}
 public record ArrivalItem(UUID id,String appointmentCode,UUID patientId,String status,Instant startsAt,long version,com.clinic.encounter.api.EncounterDto.PatientSummary patient){public ArrivalItem(UUID id,String appointmentCode,UUID patientId,String status,Instant startsAt,long version){this(id,appointmentCode,patientId,status,startsAt,version,null);}
 public ArrivalItem withPatient(com.clinic.encounter.api.EncounterDto.PatientSummary p){return new ArrivalItem(id,appointmentCode,patientId,status,startsAt,version,p);}
 public ArrivalItem(UUID id,String appointmentCode,UUID patientId,String status,Instant startsAt){this(id,appointmentCode,patientId,status,startsAt,0,null);}}
 public record ResolutionInput(UUID actorUserId,long expectedVersion,String reason){}
 public ExceptionView resolve(UUID clinic,UUID branch,UUID appointment,UUID exception,String key,ResolutionInput input){try{return this.appointment.post().uri("/api/internal/clinics/{c}/branches/{b}/appointments/{id}/exceptions/{e}/resolve",clinic,branch,appointment,exception).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON).body(input).retrieve().body(ExceptionView.class);}catch(org.springframework.web.client.HttpClientErrorException e){throw ApiProblem.conflict("Resolution rejected; reload its source state");}catch(Exception e){throw ApiProblem.dependency("Resolution outcome uncertain; retry the same key");}}
 public List<ArrivalItem> appointments(UUID clinic,UUID branch,LocalDate date){try{var list=appointment.get().uri(uri->uri.path("/api/internal/clinics/{clinic}/branches/{branch}/appointments").queryParam("date",date).build(clinic,branch)).header(HttpHeaders.AUTHORIZATION,bearer("appointment-service","appointment.arrival")).retrieve().body(ArrivalItem[].class);return list==null?List.of():List.of(list);}catch(Exception ex){throw ApiProblem.dependency("Appointment listing unavailable");}}
}

