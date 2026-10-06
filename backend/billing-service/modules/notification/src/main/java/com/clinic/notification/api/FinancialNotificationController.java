package com.clinic.notification.api;
import com.clinic.notification.FinancialNotificationService;
import com.clinic.notification.security.WorkloadPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class FinancialNotificationController{
 private final FinancialNotificationService service;public FinancialNotificationController(FinancialNotificationService service){this.service=service;}
 @PostMapping("/api/internal/notifications/billing-events")
 public FinancialNotificationService.Ack ingest(@AuthenticationPrincipal WorkloadPrincipal peer,@RequestBody JsonNode event){
  if(peer==null||!"billing-service".equals(peer.issuer())||!peer.hasScope("notification.billing.consume"))throw ApiProblem.forbidden();
  return service.ingest(event);
 }
}
