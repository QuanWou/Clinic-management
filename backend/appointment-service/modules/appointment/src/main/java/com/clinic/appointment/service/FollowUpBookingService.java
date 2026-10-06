package com.clinic.appointment.service;
import com.clinic.appointment.api.*;
import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.security.Actor;
import com.clinic.appointment.source.*;
import org.springframework.stereotype.Service;
@Service public class FollowUpBookingService {
 private final AppointmentService appointments;private final PatientSourceClient patient;private final FollowUpSources sources;
 public FollowUpBookingService(AppointmentService appointments,PatientSourceClient patient,FollowUpSources sources){this.appointments=appointments;this.patient=patient;this.sources=sources;}
 public HoldView hold(Actor actor,String bearer,String key,FollowUpInput in){
  var identity=patient.booking(in.patientId());if(actor==null||!actor.id().equals(identity.platformUserId()))throw ApiProblem.forbidden();
  var replay=appointments.replayFollowUpHold(key,in);if(replay!=null)return replay;
  var proof=sources.proof(bearer,in);return appointments.holdFollowUp(actor,key,in.booking(),proof);
 }
}
