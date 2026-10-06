package com.clinic.audit.api;

import com.clinic.audit.api.AuditDto.*;
import com.clinic.audit.service.EventEnvelopeValidator;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/event-envelope")
public class EventEnvelopeController {
    private final EventEnvelopeValidator validator;
    public EventEnvelopeController(EventEnvelopeValidator validator){this.validator=validator;}

    @PostMapping("/validate")
    public EnvelopeValidation validate(@Valid @RequestBody EventEnvelopeInput input){
        validator.validate(input);
        return new EnvelopeValidation(true,"Envelope follows the S0-05 non-PHI contract");
    }
}
