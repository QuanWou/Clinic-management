package com.clinic.v2.billing.api;
import com.clinic.v2.billing.security.ChargePeerVerifier;
import com.clinic.v2.billing.service.SourceChargeService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController public class SourceChargeController{
 private final SourceChargeService service;public SourceChargeController(SourceChargeService service){this.service=service;}
 @PostMapping("/api/v2/internal/charges/events")
 public SourceChargeService.Ack ingest(@AuthenticationPrincipal ChargePeerVerifier.Peer peer,@RequestBody JsonNode event){if(peer==null)throw ApiProblem.forbidden();return service.ingest(peer.issuer(),event);}
}
