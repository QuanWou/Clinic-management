package com.clinic.appointment.api;
import com.clinic.appointment.security.DoctorPeerVerifier;
import com.clinic.appointment.service.AbsenceConsumer;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
@RestController
@RequestMapping("/api/internal/doctor-absences")
public class InternalDoctorAbsenceController {
 private final DoctorPeerVerifier peer;private final AbsenceConsumer consumer;
 public InternalDoctorAbsenceController(DoctorPeerVerifier peer,AbsenceConsumer consumer){this.peer=peer;this.consumer=consumer;}
 @PostMapping public AbsenceConsumer.Reply accept(@RequestHeader(value="Authorization",required=false) String token,@Valid @RequestBody AbsenceConsumer.Input input){peer.require(token,"appointment.absence.consume");return consumer.accept(input);}
}
