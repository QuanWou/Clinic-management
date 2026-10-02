package com.clinic.v2.notification.api;
import com.clinic.v2.notification.FinancialNotificationService;
import com.clinic.v2.notification.security.WorkloadPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class FinancialNotificationController{
 private final FinancialNotificationService service;public FinancialNotificationController(FinancialNotificationService service){this.service=service;}
 @PostMapping("/api/v2/internal/notifications/billing-events")
 public FinancialNotificationService.Ack ingest(@AuthenticationPrincipal WorkloadPrincipal peer,@RequestBody JsonNode event){
  if(peer==null||!"billing-v2-service".equals(peer.issuer())||!peer.hasScope("notification.billing.consume"))throw ApiProblem.forbidden();
  return service.ingest(event);
 }
}
