package com.clinic.v2.notification.api;
import com.clinic.v2.notification.NotificationService;
import com.clinic.v2.notification.security.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class NotificationController{
 private final NotificationService service;public NotificationController(NotificationService service){this.service=service;}
 @PostMapping("/api/v2/internal/notifications/events") public Map<String,Boolean> ingest(@AuthenticationPrincipal WorkloadPrincipal principal,@RequestBody JsonNode event){
  if(principal==null||!"appointment-service".equals(principal.issuer())||!principal.hasScope("notification.consume"))throw ApiProblem.forbidden();
  return Map.of("applied",service.ingest(event));
 }
 @GetMapping("/api/v2/me/notifications") public List<Map<String,Object>> mine(@AuthenticationPrincipal Actor actor){return service.mine(actor);}
 public record Preference(boolean remindersEnabled){}
 @GetMapping("/api/v2/me/notification-preferences") public Preference preference(@AuthenticationPrincipal Actor actor){return new Preference(service.preference(actor));}
 @PutMapping("/api/v2/me/notification-preferences") public Preference preference(@AuthenticationPrincipal Actor actor,@RequestBody Preference input){return new Preference(service.preference(actor,input.remindersEnabled()));}
}

