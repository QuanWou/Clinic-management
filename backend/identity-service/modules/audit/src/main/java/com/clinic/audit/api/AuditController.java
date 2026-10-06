package com.clinic.audit.api;

import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.service.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/internal/audit")
public class AuditController {
    private final AuditService service;
    public AuditController(AuditService service){this.service=service;}

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public AuditView append(@Valid @RequestBody AuditInput input){return service.append(input);}

    @GetMapping("/trace/{correlationId}")
    public List<AuditView> trace(@PathVariable String correlationId){return service.trace(correlationId);}

    @GetMapping("/chain")
    public ChainVerification verify(@RequestParam(required=false) UUID clinicId){return service.verify(clinicId);}
}
