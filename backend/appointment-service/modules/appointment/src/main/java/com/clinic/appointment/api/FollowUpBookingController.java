package com.clinic.appointment.api;
import com.clinic.appointment.api.AppointmentDto.*;
import com.clinic.appointment.security.Actor;
import com.clinic.appointment.service.FollowUpBookingService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class FollowUpBookingController {
 private final FollowUpBookingService service;public FollowUpBookingController(FollowUpBookingService service){this.service=service;}
 @PostMapping("/api/appointments/follow-up-holds") public HoldView hold(@AuthenticationPrincipal Actor actor,@RequestHeader("Authorization") String bearer,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody FollowUpInput in){return service.hold(actor,bearer,key,in);}
}
