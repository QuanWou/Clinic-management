package com.clinic.v2.patient.api;
import com.clinic.v2.patient.service.PatientService;
import com.clinic.v2.patient.security.WorkloadPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController public class NotificationRecipientController{
 private final PatientService service;public NotificationRecipientController(PatientService service){this.service=service;}
 @GetMapping("/api/v2/internal/notification-recipients/clinics/{clinic}/patients/{patient}")
 public PatientService.NotificationRecipient read(@AuthenticationPrincipal WorkloadPrincipal peer,@PathVariable UUID clinic,@PathVariable UUID patient){
  if(peer==null||!"billing-v2-service".equals(peer.issuer())||!peer.hasScope("patient.notification.recipient"))throw ApiProblem.forbidden();
  return service.notificationRecipient(clinic,patient);
 }
}
