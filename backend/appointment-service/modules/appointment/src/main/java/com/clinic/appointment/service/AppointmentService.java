package com.clinic.appointment.service;

import com.clinic.appointment.api.*;
import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.domain.*;
import com.clinic.appointment.repo.*;
import com.clinic.appointment.security.*;
import com.clinic.appointment.source.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class AppointmentService {
  private final CapacitySlotRepository slots;
  private final SlotReservationRepository holds;
  private final AppointmentRepository appointments;
  private final AppointmentHistoryRepository histories;
  private final OutboxEventRepository outbox;
  private final ObjectMapper json;
  private final TenantDbContext db;
  private final ClinicSourceClient clinic;
  private final PatientSourceClient patient;
  private final DoctorSourceClient doctor;
  private final CatalogSourceClient catalog;
  private final long holdTtlSeconds;
  @org.springframework.beans.factory.annotation.Autowired private BillingSourceAuthorization receptionAuthorization;

  public AppointmentService(CapacitySlotRepository slots,SlotReservationRepository holds,AppointmentRepository appointments,
      AppointmentHistoryRepository histories,OutboxEventRepository outbox,ObjectMapper json,TenantDbContext db,
      ClinicSourceClient clinic,PatientSourceClient patient,DoctorSourceClient doctor,CatalogSourceClient catalog,
      @Value("${appointment.hold-ttl-seconds:600}") long holdTtlSeconds){
    this.slots=slots;this.holds=holds;this.appointments=appointments;this.histories=histories;this.outbox=outbox;this.json=json;this.db=db;
    this.clinic=clinic;this.patient=patient;this.doctor=doctor;this.catalog=catalog;
    this.holdTtlSeconds=Math.max(60,Math.min(1800,holdTtlSeconds));
  }

  @Transactional
  public List<AvailabilitySlot> availability(UUID clinicId,UUID branchId,UUID offeringId,UUID doctorId,LocalDate date){
    return availabilityResult(clinicId,branchId,offeringId,doctorId,date).slots();
  }

  @Transactional(readOnly=true)
  public BookingOptions bookingOptions(UUID clinicId,UUID branchId){
    clinic.requireEligible(clinicId,branchId);
    var sourceDoctors=doctor.listDoctors(clinicId,branchId);
    var sourceOfferings=catalog.listOfferings(clinicId,branchId).stream()
      .filter(o->o.specialtyCode()!=null&&!o.specialtyCode().isBlank()&&o.durationMinutes()!=null&&o.durationMinutes()>=5)
      .toList();
    var eligibleDoctors=sourceDoctors.stream()
      .filter(d->d.specialtyCode()!=null&&!d.specialtyCode().isBlank())
      .filter(d->Optional.ofNullable(d.schedules()).orElse(List.of()).stream().anyMatch(this::validScheduleDefinition))
      .filter(d->sourceOfferings.stream().anyMatch(o->sameSpecialty(d.specialtyCode(),o.specialtyCode())))
      .map(d->new BookingDoctor(d.practitionerId(),d.displayName(),d.specialtyCode(),d.specialtyName(),d.professionalTitle(),
        Optional.ofNullable(d.schedules()).orElse(List.of()).stream().filter(this::validScheduleDefinition)
          .map(s->new BookingSchedule(s.dayOfWeek(),s.startTime(),s.endTime(),s.timezone(),s.effectiveFrom(),s.effectiveUntil(),s.version())).toList()))
      .toList();
    Set<String> specialtyCodes=new LinkedHashSet<>();
    eligibleDoctors.forEach(d->specialtyCodes.add(d.specialtyCode()));
    var eligibleOfferings=sourceOfferings.stream().filter(o->specialtyCodes.stream().anyMatch(code->sameSpecialty(code,o.specialtyCode())))
      .map(o->new BookingOffering(o.offeringId(),o.code(),o.name(),o.specialtyCode(),o.durationMinutes())).toList();
    Map<String,String> names=new LinkedHashMap<>();
    eligibleDoctors.forEach(d->names.putIfAbsent(d.specialtyCode(),d.specialtyName()==null||d.specialtyName().isBlank()?d.specialtyCode():d.specialtyName()));
    var specialties=names.entrySet().stream().sorted(Map.Entry.comparingByValue(String.CASE_INSENSITIVE_ORDER))
      .map(e->new BookingSpecialty(e.getKey(),e.getValue())).toList();
    return new BookingOptions(specialties,eligibleDoctors,eligibleOfferings);
  }

  @Transactional
  public AvailabilityResult availabilityResult(UUID clinicId,UUID branchId,UUID offeringId,UUID doctorId,LocalDate date){
    clinic.requireEligible(clinicId,branchId);
    var d=doctor.findDoctor(clinicId,branchId,doctorId).orElse(null);
    if(d==null)return availabilityResult(false,AvailabilityReason.DOCTOR_UNAVAILABLE,doctorId,null,date,List.of());
    var o=catalog.findOffering(clinicId,branchId,offeringId).orElse(null);
    if(o==null||o.durationMinutes()==null||o.durationMinutes()<5||!sameSpecialty(d.specialtyCode(),o.specialtyCode()))
      return availabilityResult(false,AvailabilityReason.SERVICE_NOT_SUPPORTED,doctorId,d.displayName(),date,List.of());
    db.tenant(clinicId);db.lockDoctor(doctorId);
    Instant now=Instant.now();

    ZoneId defaultZone=ZoneId.of("Asia/Ho_Chi_Minh");
    Instant dayStart=date.atStartOfDay(defaultZone).toInstant();
    Instant dayEnd=date.plusDays(1).atStartOfDay(defaultZone).toInstant();
    var existing=slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAtBetweenOrderByStartsAtAsc(
      clinicId,branchId,offeringId,doctorId,dayStart,dayEnd);
    existing.forEach(s->s.active=false);

    var schedules=Optional.ofNullable(d.schedules()).orElse(List.of()).stream().filter(this::validScheduleDefinition).toList();
    if(schedules.isEmpty()){
      slots.flush();
      return availabilityResult(false,AvailabilityReason.NO_CAPACITY_CONFIGURED,doctorId,d.displayName(),date,List.of());
    }
    var applicable=schedules.stream().filter(s->validOn(s,date)).toList();
    if(applicable.isEmpty()){
      slots.flush();
      return availabilityResult(false,AvailabilityReason.DOCTOR_NOT_WORKING,doctorId,d.displayName(),date,List.of());
    }

    int futureCandidates=0;int availableToSchedule=0;
    for(var schedule:applicable){
      ZoneId zone=ZoneId.of(schedule.timezone()==null||schedule.timezone().isBlank()?"Asia/Ho_Chi_Minh":schedule.timezone());
      ZonedDateTime cursor=ZonedDateTime.of(date,schedule.startTime(),zone);
      ZonedDateTime end=ZonedDateTime.of(schedule.endTime().equals(LocalTime.MIDNIGHT)?date.plusDays(1):date,schedule.endTime(),zone);
      while(!cursor.plusMinutes(o.durationMinutes()).isAfter(end)){
        Instant start=cursor.toInstant();Instant finish=cursor.plusMinutes(o.durationMinutes()).toInstant();
        if(start.isAfter(now)){
          futureCandidates++;
          if(!absent(d,start,finish)){
            availableToSchedule++;
          CapacitySlot s=slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAt(clinicId,branchId,offeringId,doctorId,start)
            .orElseGet(CapacitySlot::new);
          s.clinicId=clinicId;s.branchId=branchId;s.offeringId=offeringId;s.doctorId=doctorId;s.startsAt=start;
          if(s.id!=null&&!finish.equals(s.endsAt)&&
              slots.countOverlapping(doctorId,start,s.endsAt,now,null,null)>0)continue;
          s.endsAt=finish;s.capacity=1;s.scheduleVersion=schedule.version();s.offeringVersion=o.branchOfferingVersion();s.active=true;slots.save(s);
          }
        }
        cursor=cursor.plusMinutes(o.durationMinutes());
      }
    }
    slots.flush();

    var all=slots.findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAtBetweenOrderByStartsAtAsc(
      clinicId,branchId,offeringId,doctorId,dayStart,dayEnd).stream()
      .filter(s->s.active&&s.startsAt.isAfter(now))
      .map(s->slotView(s,o,now)).toList();
    var open=all.stream().filter(x->x.remaining()>0).toList();
    if(!open.isEmpty())return availabilityResult(true,AvailabilityReason.AVAILABLE,doctorId,d.displayName(),date,open);
    if(futureCandidates>0&&availableToSchedule==0)return availabilityResult(false,AvailabilityReason.DOCTOR_UNAVAILABLE,doctorId,d.displayName(),date,List.of());
    if(!all.isEmpty())return availabilityResult(false,AvailabilityReason.FULLY_BOOKED,doctorId,d.displayName(),date,List.of());
    return availabilityResult(false,AvailabilityReason.NO_CAPACITY_CONFIGURED,doctorId,d.displayName(),date,List.of());
  }

  @Transactional
  public HoldView hold(Actor actor,String idempotencyKey,HoldInput in){
    return createHold(actor,idempotencyKey,in,null,null,false);
  }
  @Transactional
  public HoldView holdFollowUp(Actor actor,String key,HoldInput in,FollowUpSources.Proof proof){
    if(proof==null||proof.encounterId()==null||proof.branchId()==null||!in.patientId().equals(proof.patientId())||proof.medicalVersion()<1||proof.proposedDate()==null)throw ApiProblem.invalid("Verified follow-up source proof required");
    return createHold(actor,key,in,proof,null,false);
  }
  @Transactional
  public HoldView holdReschedule(Actor actor,UUID appointmentId,String key,HoldInput in){
    var identity=patient.booking(in.patientId());
    if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
    db.tenant(in.clinicId());
    var original=appointments.lockById(appointmentId).filter(a->a.clinicId.equals(in.clinicId())&&a.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if(!"CONFIRMED".equals(original.status))throw ApiProblem.conflict("Chỉ có thể đổi lịch chưa tiếp nhận.");
    return createHold(actor,key,in,null,appointmentId,false);
  }
  // The facade resolves active Patient ownership before this local replay read.
  @Transactional(readOnly=true)
  public HoldView replayFollowUpHold(String key,FollowUpInput in){
    requireKey(key);db.tenant(in.clinicId());
    var old=holds.findByPatientIdAndIdempotencyKey(in.patientId(),key).orElse(null);if(old==null)return null;
    if(!in.priorEncounterId().equals(old.priorEncounterId)||!in.priorBranchId().equals(old.priorBranchId)||old.priorMedicalVersion==null||old.priorProposedDate==null)throw ApiProblem.conflict("Follow-up key source changed");
    var proof=new FollowUpSources.Proof(old.priorEncounterId,old.priorBranchId,old.patientId,old.priorMedicalVersion,old.priorProposedDate);
    if(!old.payloadHash.equals(holdPayload(in.booking(),proof)))throw ApiProblem.conflict("Follow-up key booking data changed");return holdView(old);
  }
  private String holdPayload(HoldInput in,FollowUpSources.Proof proof){
    String raw=in.clinicId()+"|"+in.branchId()+"|"+in.offeringId()+"|"+in.doctorId()+"|"+in.slotId()+"|"+in.patientId();
    if(proof!=null)raw+="|follow-up|"+proof.encounterId()+"|"+proof.branchId()+"|"+proof.medicalVersion()+"|"+proof.proposedDate();return hash(raw);
  }
  private HoldView createHold(Actor actor,String idempotencyKey,HoldInput in,FollowUpSources.Proof prior,UUID rescheduleId,boolean reception){
    requireKey(idempotencyKey);
    clinic.requireEligible(in.clinicId(),in.branchId());
    if(reception){if(actor==null)throw ApiProblem.forbidden();receptionAuthorization.requireCapability(actor.id(),in.clinicId(),in.branchId(),"RECEPTION");}
    else {var identity=patient.booking(in.patientId());if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();}
    var d=doctor.requireDoctor(in.clinicId(),in.branchId(),in.doctorId());
    var o=catalog.requireOffering(in.clinicId(),in.branchId(),in.offeringId());
    db.tenant(in.clinicId());db.lockKey(in.patientId(),"hold",idempotencyKey);db.lockDoctor(in.doctorId());Instant now=Instant.now();

    String payload=holdPayload(in,prior);
    if(rescheduleId!=null)payload=hash(payload+"|reschedule|"+rescheduleId);
    var replay=holds.findByPatientIdAndIdempotencyKey(in.patientId(),idempotencyKey).orElse(null);
    if(replay!=null){
      if(!replay.payloadHash.equals(payload))throw ApiProblem.conflict("Idempotency key was already used with different booking data");
      return holdView(replay);
    }

    CapacitySlot slot=slots.lockById(in.slotId()).filter(s->s.clinicId.equals(in.clinicId())&&s.branchId.equals(in.branchId())
      &&s.offeringId.equals(in.offeringId())&&s.doctorId.equals(in.doctorId())).orElseThrow(ApiProblem::missing);
    if(!sameSpecialty(d.specialtyCode(),o.specialtyCode())||!slot.active||!slot.startsAt.isAfter(now)||!slotValidAgainstSources(slot,d,o))throw ApiProblem.unavailable("Selected slot is no longer available");
    long used=slots.countOverlapping(slot.doctorId,slot.startsAt,slot.endsAt,now,null,null);
    if(used>=slot.capacity)throw ApiProblem.unavailable("Selected slot has just been taken");

    SlotReservation h=new SlotReservation();h.slotId=slot.id;h.clinicId=slot.clinicId;h.branchId=slot.branchId;h.patientId=in.patientId();h.rescheduleAppointmentId=rescheduleId;
    if(prior!=null){h.priorEncounterId=prior.encounterId();h.priorBranchId=prior.branchId();h.priorMedicalVersion=prior.medicalVersion();h.priorProposedDate=prior.proposedDate();}
    h.priceVersionId=o.priceVersionId();h.amountVnd=o.amountVnd();h.currency=o.currency();h.priceEffectiveFrom=o.effectiveFrom();
    h.taxPolicyCode=o.taxPolicyCode();h.discountPolicyCode=o.discountPolicyCode();h.state="ACTIVE";
    h.expiresAt=now.plusSeconds(holdTtlSeconds);h.idempotencyKey=idempotencyKey;h.payloadHash=payload;
    holds.saveAndFlush(h);return holdView(h);
  }

  @Transactional
  public AppointmentView confirm(Actor actor,String idempotencyKey,ConfirmInput in){
    requireKey(idempotencyKey);
    var identity=patient.booking(in.patientId());
    if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
    db.tenant(in.clinicId());db.lockKey(in.patientId(),"confirm",idempotencyKey);Instant now=Instant.now();

    SlotReservation h=holds.lockById(in.holdId()).filter(x->x.clinicId.equals(in.clinicId())&&x.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if(h.rescheduleAppointmentId!=null)throw ApiProblem.conflict("Giờ này dùng để đổi lịch. Hãy tiếp tục đổi lịch gốc, không tạo lịch mới.");
    CapacitySlot referencedSlot=slots.findById(h.slotId).orElseThrow(ApiProblem::missing);
    db.lockDoctor(referencedSlot.doctorId);
    now=Instant.now();
    clinic.requireEligible(h.clinicId,h.branchId);
    var replay=appointments.findByPatientIdAndConfirmationKey(in.patientId(),idempotencyKey).orElse(null);
    if(replay!=null){
      if(!replay.reservationId.equals(h.id))throw ApiProblem.conflict("Confirmation key was already used for another hold");
      return appointmentView(replay);
    }
    var existing=appointments.findByReservationId(h.id).orElse(null);
    if(existing!=null)return appointmentView(existing);
    if(!"ACTIVE".equals(h.state)||!h.expiresAt.isAfter(now)){
      h.state="EXPIRED";holds.save(h);throw ApiProblem.unavailable("Slot hold expired; choose another time");
    }
    CapacitySlot slot=slots.lockById(h.slotId).orElseThrow(ApiProblem::missing);
    var sourceDoctor=doctor.requireDoctor(h.clinicId,h.branchId,slot.doctorId);
    var sourceOffering=catalog.requireOffering(h.clinicId,h.branchId,slot.offeringId);
    if(!slot.active||!slot.startsAt.isAfter(now)||!slotValidAgainstSources(slot,sourceDoctor,sourceOffering))throw ApiProblem.unavailable("Slot source changed after hold; choose another time");
    long occupancy=slots.countOverlapping(slot.doctorId,slot.startsAt,slot.endsAt,now,h.id.toString(),null);
    if(occupancy>=slot.capacity)throw ApiProblem.unavailable("Slot capacity is no longer available");
    var link=patient.clinicLink(in.patientId(),h.clinicId);

    Appointment a=new Appointment();a.appointmentCode=code(now);a.clinicId=h.clinicId;a.branchId=h.branchId;a.patientId=h.patientId;
    a.priorEncounterId=h.priorEncounterId;a.priorBranchId=h.priorBranchId;a.priorMedicalVersion=h.priorMedicalVersion;a.priorProposedDate=h.priorProposedDate;
    a.clinicPatientLinkId=link.id();a.offeringId=slot.offeringId;a.doctorId=slot.doctorId;a.slotId=slot.id;a.reservationId=h.id;
    a.priceVersionId=h.priceVersionId;a.amountVnd=h.amountVnd;a.currency=h.currency;a.priceEffectiveFrom=h.priceEffectiveFrom;
    a.taxPolicyCode=h.taxPolicyCode;a.discountPolicyCode=h.discountPolicyCode;a.status="CONFIRMED";a.confirmationKey=idempotencyKey;
    appointments.saveAndFlush(a);
    h.state="CONSUMED";h.consumedAt=now;holds.save(h);
    history(a,null,"CONFIRMED",actor.id(),null,null,null,null,null,null);
    emit(a,"clinic.appointment.confirmed.v1",null,Map.of("appointmentId",a.id.toString(),"patientRef",a.patientId.toString(),"slotId",a.slotId.toString(),"status",a.status),actor.id());
    return appointmentView(a);
  }

  @Transactional
  public AppointmentView cancel(Actor actor,UUID appointmentId,CancelInput in){
    var identity=patient.booking(in.patientId());if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
    db.tenant(in.clinicId());
    Appointment a=appointments.lockById(appointmentId).filter(x->x.clinicId.equals(in.clinicId())&&x.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if("CANCELLED".equals(a.status))return appointmentView(a);
    if(!"CONFIRMED".equals(a.status))throw ApiProblem.invalid("Only confirmed appointments can be cancelled in S1");
    String from=a.status;a.status="CANCELLED";a.cancelledAt=Instant.now();appointments.saveAndFlush(a);
    history(a,from,"CANCELLED",actor.id(),in.reason(),in.correlationId(),a.slotId,null,a.reservationId,null);
    emit(a,"clinic.appointment.cancelled.v1",in.correlationId(),Map.of("appointmentId",a.id.toString(),"patientRef",a.patientId.toString(),"slotId",a.slotId.toString(),"status",a.status),actor.id());
    return appointmentView(a);
  }

  @Transactional
  public AppointmentView reschedule(Actor actor,UUID appointmentId,RescheduleInput in){return doReschedule(actor,appointmentId,in,false);}
  private AppointmentView doReschedule(Actor actor,UUID appointmentId,RescheduleInput in,boolean reception){
    if(!reception){var identity=patient.booking(in.patientId());if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();}
    db.tenant(in.clinicId());
    Appointment a=appointments.lockById(appointmentId).filter(x->x.clinicId.equals(in.clinicId())&&x.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if(!"CONFIRMED".equals(a.status))throw ApiProblem.invalid("Only confirmed appointments can be rescheduled");
    SlotReservation nh=holds.lockById(in.newHoldId()).filter(x->x.clinicId.equals(in.clinicId())&&x.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if(!appointmentId.equals(nh.rescheduleAppointmentId))throw ApiProblem.conflict("Giờ đang giữ không thuộc thao tác đổi lịch này.");
    if(a.reservationId.equals(in.newHoldId()))return appointmentView(a);
    if(!"ACTIVE".equals(nh.state)||!nh.expiresAt.isAfter(Instant.now()))throw ApiProblem.unavailable("New slot hold expired");
    clinic.requireEligible(nh.clinicId,nh.branchId);
    db.lockDoctor(slots.findById(nh.slotId).orElseThrow(ApiProblem::missing).doctorId);
    CapacitySlot newSlot=slots.lockById(nh.slotId).orElseThrow(ApiProblem::missing);
    var sourceDoctor=doctor.requireDoctor(nh.clinicId,nh.branchId,newSlot.doctorId);
    var sourceOffering=catalog.requireOffering(nh.clinicId,nh.branchId,newSlot.offeringId);
    if(!sameSpecialty(sourceDoctor.specialtyCode(),sourceOffering.specialtyCode())||!newSlot.active||!newSlot.startsAt.isAfter(Instant.now())||!slotValidAgainstSources(newSlot,sourceDoctor,sourceOffering))throw ApiProblem.unavailable("New slot source changed after hold");
    if(slots.countOverlapping(newSlot.doctorId,newSlot.startsAt,newSlot.endsAt,Instant.now(),nh.id.toString(),a.id.toString())>=newSlot.capacity)
      throw ApiProblem.unavailable("New slot is no longer available");

    UUID oldSlot=a.slotId,oldReservation=a.reservationId;
    history(a,"CONFIRMED","RESCHEDULED",actor.id(),in.reason(),in.correlationId(),oldSlot,newSlot.id,oldReservation,nh.id);
    a.branchId=nh.branchId;a.offeringId=newSlot.offeringId;a.doctorId=newSlot.doctorId;a.slotId=newSlot.id;a.reservationId=nh.id;
    a.priceVersionId=nh.priceVersionId;a.amountVnd=nh.amountVnd;a.currency=nh.currency;a.priceEffectiveFrom=nh.priceEffectiveFrom;
    a.taxPolicyCode=nh.taxPolicyCode;a.discountPolicyCode=nh.discountPolicyCode;a.status="CONFIRMED";appointments.saveAndFlush(a);
    nh.state="CONSUMED";nh.consumedAt=Instant.now();holds.save(nh);
    history(a,"RESCHEDULED","CONFIRMED",actor.id(),in.reason(),in.correlationId(),oldSlot,newSlot.id,oldReservation,nh.id);
    emit(a,"clinic.appointment.rescheduled.v1",in.correlationId(),Map.of("appointmentId",a.id.toString(),"patientRef",a.patientId.toString(),"oldSlotId",oldSlot.toString(),"newSlotId",newSlot.id.toString(),"status",a.status),actor.id());
    return appointmentView(a);
  }

  @Transactional(readOnly=true)
  public List<AppointmentView> mine(Actor actor,UUID clinicId,UUID patientId){
    var identity=patient.booking(patientId);if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
    db.tenant(clinicId);
    return appointments.findByPatientIdOrderByCreatedAtDesc(patientId).stream().filter(a->a.clinicId.equals(clinicId)).map(this::appointmentView).toList();
  }

  @Transactional(readOnly=true)
  public AppointmentView receptionRead(Actor actor,UUID clinicId,UUID branchId,UUID id){
    if(actor==null)throw ApiProblem.forbidden();receptionAuthorization.requireCapability(actor.id(),clinicId,branchId,"RECEPTION");db.tenant(clinicId);
    return appointmentView(appointments.findById(id).filter(a->a.clinicId.equals(clinicId)&&a.branchId.equals(branchId)).orElseThrow(ApiProblem::missing));
  }
  @Transactional
  public HoldView receptionHold(Actor actor,UUID id,String key,HoldInput in,long expectedVersion){
    if(actor==null)throw ApiProblem.forbidden();receptionAuthorization.requireCapability(actor.id(),in.clinicId(),in.branchId(),"RECEPTION");db.tenant(in.clinicId());
    var original=appointments.lockById(id).filter(a->a.clinicId.equals(in.clinicId())&&a.branchId.equals(in.branchId())&&a.patientId.equals(in.patientId())).orElseThrow(ApiProblem::missing);
    if(!"CONFIRMED".equals(original.status)||original.encounterId!=null||original.version!=expectedVersion)throw ApiProblem.conflict("Lịch đã tiếp nhận hoặc thay đổi. Tải lại trước khi đổi.");
    return createHold(actor,key,in,null,id,true);
  }
  @Transactional
  public AppointmentView receptionReschedule(Actor actor,UUID clinicId,UUID branchId,UUID id,RescheduleInput in,long expectedVersion){
    if(actor==null)throw ApiProblem.forbidden();receptionAuthorization.requireCapability(actor.id(),clinicId,branchId,"RECEPTION");db.tenant(clinicId);
    var original=appointments.lockById(id).filter(a->a.clinicId.equals(clinicId)&&a.branchId.equals(branchId)&&a.patientId.equals(in.patientId())&&in.clinicId().equals(clinicId)).orElseThrow(ApiProblem::missing);
    if(original.reservationId.equals(in.newHoldId())&&"CONFIRMED".equals(original.status))return appointmentView(original);
    if(!"CONFIRMED".equals(original.status)||original.encounterId!=null||original.version!=expectedVersion)throw ApiProblem.conflict("Lượt khám đã tiếp nhận. Lễ tân không có quyền điều chuyển bác sĩ.");
    var hold=holds.findById(in.newHoldId()).filter(h->h.clinicId.equals(clinicId)&&h.branchId.equals(branchId)).orElseThrow(ApiProblem::missing);
    return doReschedule(actor,id,in,true);
  }
  private boolean validOn(DoctorSourceClient.Schedule s,LocalDate date){
    if(s.effectiveFrom()==null||s.startTime()==null||s.endTime()==null)return false;
    return s.dayOfWeek()==date.getDayOfWeek().getValue()&&!date.isBefore(s.effectiveFrom())&&(s.effectiveUntil()==null||date.isBefore(s.effectiveUntil()));
  }
  private boolean validScheduleDefinition(DoctorSourceClient.Schedule s){
    return s!=null&&s.dayOfWeek()>=1&&s.dayOfWeek()<=7&&s.effectiveFrom()!=null&&s.startTime()!=null&&s.endTime()!=null&&
      (s.endTime().equals(LocalTime.MIDNIGHT)||s.endTime().isAfter(s.startTime()));
  }
  private boolean sameSpecialty(String left,String right){return left!=null&&right!=null&&left.trim().equalsIgnoreCase(right.trim());}
  private AvailabilityResult availabilityResult(boolean available,AvailabilityReason reason,UUID doctorId,String doctorName,LocalDate date,List<AvailabilitySlot> values){
    return new AvailabilityResult(available,reason,doctorId,doctorName,date,values==null?List.of():values);
  }
  @Transactional(readOnly=true)
  public List<PendingHoldView> mineHolds(Actor actor,UUID clinicId,UUID patientId){
    var identity=patient.booking(patientId);if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
    db.tenant(clinicId);
    return holds.findByPatientIdAndStateAndExpiresAtAfterOrderByCreatedAtDesc(patientId,"ACTIVE",Instant.now()).stream().limit(50).map(h->{
      var slot=slots.findById(h.slotId).orElseThrow(ApiProblem::missing);
      return new PendingHoldView(holdView(h),slot.offeringId,slot.doctorId,slot.startsAt,slot.endsAt);
    }).toList();
  }
  private boolean slotValidAgainstSources(CapacitySlot slot,DoctorSourceClient.Doctor d,CatalogSourceClient.Offering o){
    if(absent(d,slot.startsAt,slot.endsAt))return false;
    if(!slot.offeringId.equals(o.offeringId())||!slot.doctorId.equals(d.practitionerId()))return false;
    if(!slot.clinicId.equals(d.clinicId())||!slot.branchId.equals(d.branchId())||
       !slot.clinicId.equals(o.clinicId())||!slot.branchId.equals(o.branchId())||
       o.durationMinutes()==null||slot.offeringVersion!=o.branchOfferingVersion()||
       !slot.endsAt.equals(slot.startsAt.plusSeconds(o.durationMinutes()*60L)))return false;
    ZonedDateTime start=slot.startsAt.atZone(ZoneId.of("Asia/Ho_Chi_Minh"));
    LocalDate date=start.toLocalDate();LocalTime time=start.toLocalTime();
    return Optional.ofNullable(d.schedules()).orElse(List.of()).stream().anyMatch(s->{
      ZoneId zone=ZoneId.of(s.timezone()==null||s.timezone().isBlank()?"Asia/Ho_Chi_Minh":s.timezone());
      ZonedDateTime localized=slot.startsAt.atZone(zone);
      Instant scheduleStart=ZonedDateTime.of(localized.toLocalDate(),s.startTime(),zone).toInstant();
      Instant scheduleEnd=ZonedDateTime.of(s.endTime().equals(LocalTime.MIDNIGHT)?localized.toLocalDate().plusDays(1):localized.toLocalDate(),s.endTime(),zone).toInstant();
      return s.version()==slot.scheduleVersion&&validOn(s,localized.toLocalDate())&&
        !slot.startsAt.isBefore(scheduleStart)&&!slot.endsAt.isAfter(scheduleEnd)&&
        Duration.between(scheduleStart,slot.startsAt).toMinutes()%o.durationMinutes()==0;
    });
  }
  private AvailabilitySlot slotView(CapacitySlot s,CatalogSourceClient.Offering o,Instant now){
    long used=slots.countOverlapping(s.doctorId,s.startsAt,s.endsAt,now,null,null);int remaining=(int)Math.max(0,s.capacity-used);
    return new AvailabilitySlot(s.id,s.clinicId,s.branchId,s.offeringId,s.doctorId,s.startsAt,s.endsAt,s.capacity,remaining,s.scheduleVersion,s.offeringVersion,
      new PriceSnapshot(o.priceVersionId(),o.amountVnd(),o.currency(),o.effectiveFrom(),o.taxPolicyCode(),o.discountPolicyCode()));
  }
  private boolean absent(DoctorSourceClient.Doctor d,Instant start,Instant end){return Optional.ofNullable(d.absences()).orElse(List.of()).stream().anyMatch(a->a==null||a.startsAt()==null||a.endsAt()==null||!a.endsAt().isAfter(a.startsAt())||(start.isBefore(a.endsAt())&&end.isAfter(a.startsAt())));}
  private HoldView holdView(SlotReservation h){return new HoldView(h.id,h.slotId,h.clinicId,h.branchId,h.patientId,h.state,h.expiresAt,new PriceSnapshot(h.priceVersionId,h.amountVnd,h.currency,h.priceEffectiveFrom,h.taxPolicyCode,h.discountPolicyCode),h.rescheduleAppointmentId!=null?"RESCHEDULE":h.priorEncounterId!=null?"FOLLOW_UP":"BOOKING",h.rescheduleAppointmentId,h.priorEncounterId);}
  private AppointmentView appointmentView(Appointment a){
    CapacitySlot s=slots.findById(a.slotId).orElseThrow(ApiProblem::missing);
    return new AppointmentView(a.id,a.appointmentCode,a.clinicId,a.branchId,a.patientId,a.clinicPatientLinkId,a.offeringId,a.doctorId,a.slotId,a.status,s.startsAt,s.endsAt,
      new PriceSnapshot(a.priceVersionId,a.amountVnd,a.currency,a.priceEffectiveFrom,a.taxPolicyCode,a.discountPolicyCode),a.version,a.priorEncounterId,a.priorBranchId);
  }
  private void history(Appointment a,String from,String to,UUID actor,String reason,String correlation,UUID oldSlot,UUID newSlot,UUID oldReservation,UUID newReservation){
    AppointmentHistory h=new AppointmentHistory();h.appointmentId=a.id;h.fromStatus=from;h.toStatus=to;h.actorUserId=actor;h.reason=reason;h.correlationId=correlation;
    h.oldSlotId=oldSlot;h.newSlotId=newSlot;h.oldReservationId=oldReservation;h.newReservationId=newReservation;histories.save(h);
  }
  private void emit(Appointment a,String type,String correlation,Map<String,Object> data,UUID actorId){
    OutboxEvent e=new OutboxEvent();e.eventId=UUID.randomUUID();e.eventType=type;e.aggregateId=a.id;e.correlationId=correlation==null||correlation.isBlank()?UUID.randomUUID().toString():correlation;
    Map<String,Object> envelope=new LinkedHashMap<>();envelope.put("specversion","1.0");envelope.put("id",e.eventId.toString());
    envelope.put("source","/services/appointment");envelope.put("type",type);envelope.put("subject","appointment/"+a.id);
    envelope.put("time",Instant.now().toString());envelope.put("datacontenttype","application/json");envelope.put("clinicid",a.clinicId.toString());
    Map<String,Object> safeData=new LinkedHashMap<>(data);safeData.put("actorUserId",actorId.toString());safeData.put("startsAt",slots.findById(a.slotId).orElseThrow(ApiProblem::missing).startsAt.toString());
    envelope.put("branchid",a.branchId.toString());envelope.put("correlationid",e.correlationId);envelope.put("aggregateversion",Math.max(1,a.version+1));envelope.put("data",safeData);
    try{e.payloadJson=json.writeValueAsString(envelope);}catch(JsonProcessingException ex){throw new IllegalStateException("Event serialization failed",ex);}
    outbox.save(e);
  }
  private void requireKey(String key){if(key==null||key.isBlank()||key.length()>120)throw ApiProblem.invalid("Idempotency-Key is required");}
  private String hash(String raw){
    try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));}
    catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
  }
  private String code(Instant now){return "AP-"+LocalDateTime.ofInstant(now,ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate().toString().replace("-","")+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase(Locale.ROOT);}
}
