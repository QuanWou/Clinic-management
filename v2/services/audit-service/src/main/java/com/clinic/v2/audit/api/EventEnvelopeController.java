package com.clinic.v2.audit.api;

import com.clinic.v2.audit.api.AuditDto.*;
import com.clinic.v2.audit.service.EventEnvelopeValidator;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/internal/event-envelope")
public class EventEnvelopeController {
    private final EventEnvelopeValidator validator;
    public EventEnvelopeController(EventEnvelopeValidator validator){this.validator=validator;}

    @PostMapping("/validate")
    public EnvelopeValidation validate(@Valid @RequestBody EventEnvelopeInput input){
        validator.validate(input);
        return new EnvelopeValidation(true,"Envelope follows the S0-05 non-PHI contract");
    }
}
