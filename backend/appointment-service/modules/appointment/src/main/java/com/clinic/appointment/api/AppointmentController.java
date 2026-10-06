package com.clinic.appointment.api;

import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.security.Actor;
import com.clinic.appointment.service.AppointmentService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
public class AppointmentController {
  private final AppointmentService service;
  public AppointmentController(AppointmentService service){this.service=service;}

  @GetMapping("/public/availability")
  public List<AvailabilitySlot> availability(@RequestParam UUID clinicId,@RequestParam UUID branchId,
      @RequestParam UUID offeringId,@RequestParam UUID doctorId,@RequestParam LocalDate date){
    return service.availability(clinicId,branchId,offeringId,doctorId,date);
  }

  @GetMapping("/public/availability/evaluate")
  public AvailabilityResult evaluateAvailability(@RequestParam UUID clinicId,@RequestParam UUID branchId,
      @RequestParam UUID offeringId,@RequestParam UUID doctorId,@RequestParam LocalDate date){
    return service.availabilityResult(clinicId,branchId,offeringId,doctorId,date);
  }

  @GetMapping("/public/booking-options")
  public BookingOptions bookingOptions(@RequestParam UUID clinicId,@RequestParam UUID branchId){
    return service.bookingOptions(clinicId,branchId);
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

  @PostMapping("/appointments/{appointmentId}/reschedule-holds")
  @ResponseStatus(HttpStatus.CREATED)
  public HoldView rescheduleHold(@AuthenticationPrincipal Actor actor,@PathVariable UUID appointmentId,
      @RequestHeader("Idempotency-Key") String key,@Valid @RequestBody HoldInput input){
    return service.holdReschedule(actor,appointmentId,key,input);
  }

  @GetMapping("/me/appointments")
  public List<AppointmentView> mine(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId,@RequestParam UUID patientId){
    return service.mine(actor,clinicId,patientId);
  }
  @GetMapping("/me/appointment-holds")
  public List<PendingHoldView> holds(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId,@RequestParam UUID patientId){return service.mineHolds(actor,clinicId,patientId);}
}
