package com.clinic.notification.api;
import com.clinic.notification.NotificationService;
import com.clinic.notification.security.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class NotificationController{
 private final NotificationService service;public NotificationController(NotificationService service){this.service=service;}
 @PostMapping("/api/internal/notifications/events") public Map<String,Boolean> ingest(@AuthenticationPrincipal WorkloadPrincipal principal,@RequestBody JsonNode event){
  if(principal==null||!"appointment-service".equals(principal.issuer())||!principal.hasScope("notification.consume"))throw ApiProblem.forbidden();
  return Map.of("applied",service.ingest(event));
 }
 @GetMapping("/api/me/notifications") public List<Map<String,Object>> mine(@AuthenticationPrincipal Actor actor){return service.mine(actor);}
 public record Preference(boolean remindersEnabled){}
 @GetMapping("/api/me/notification-preferences") public Preference preference(@AuthenticationPrincipal Actor actor){return new Preference(service.preference(actor));}
 @PutMapping("/api/me/notification-preferences") public Preference preference(@AuthenticationPrincipal Actor actor,@RequestBody Preference input){return new Preference(service.preference(actor,input.remindersEnabled()));}
}

