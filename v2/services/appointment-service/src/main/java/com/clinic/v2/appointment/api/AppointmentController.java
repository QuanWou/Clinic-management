package com.clinic.v2.appointment.api;

import com.clinic.v2.appointment.api.AppointmentDto.*;
import com.clinic.v2.appointment.security.Actor;
import com.clinic.v2.appointment.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v2")
public class AppointmentController {
  private final AppointmentService service;
  public AppointmentController(AppointmentService service){this.service=service;}

  @GetMapping("/public/availability")
  public List<AvailabilitySlot> availability(@RequestParam UUID clinicId,@RequestParam UUID branchId,
      @RequestParam UUID offeringId,@RequestParam UUID doctorId,@RequestParam LocalDate date){
    return service.availability(clinicId,branchId,offeringId,doctorId,date);
  }

  @PostMapping("/appointments/holds")
  @ResponseStatus(HttpStatus.CREATED)
  public HoldView hold(@AuthenticationPrincipal Actor actor,
      @RequestHeader("Idempotency-Key") String idempotencyKey,@Valid @RequestBody HoldInput input){
    return service.hold(actor,idempotencyKey,input);
  }

  @PostMapping("/appointments")
  @ResponseStatus(HttpStatus.CREATED)
  public AppointmentView confirm(@AuthenticationPrincipal Actor actor,
      @RequestHeader("Idempotency-Key") String idempotencyKey,@Valid @RequestBody ConfirmInput input){
    return service.confirm(actor,idempotencyKey,input);
  }

  @PostMapping("/appointments/{appointmentId}/cancel")
  public AppointmentView cancel(@AuthenticationPrincipal Actor actor,@PathVariable UUID appointmentId,
      @Valid @RequestBody CancelInput input){
    return service.cancel(actor,appointmentId,input);
  }

  @PostMapping("/appointments/{appointmentId}/reschedule")
  public AppointmentView reschedule(@AuthenticationPrincipal Actor actor,@PathVariable UUID appointmentId,
      @Valid @RequestBody RescheduleInput input){
    return service.reschedule(actor,appointmentId,input);
  }

  @GetMapping("/me/appointments")
  public List<AppointmentView> mine(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId,@RequestParam UUID patientId){
    return service.mine(actor,clinicId,patientId);
  }
  @GetMapping("/me/appointment-holds")
  public List<PendingHoldView> holds(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId,@RequestParam UUID patientId){return service.mineHolds(actor,clinicId,patientId);}
}
