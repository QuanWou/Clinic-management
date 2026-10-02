package com.clinic.v2.audit.service;

import com.clinic.v2.audit.api.*;
import com.clinic.v2.audit.api.AuditDto.EventEnvelopeInput;
import org.springframework.stereotype.Component;

@Component
public class EventEnvelopeValidator {
    private final SafeMetadata safe;
    public EventEnvelopeValidator(SafeMetadata safe){this.safe=safe;}

    public void validate(EventEnvelopeInput e){
        if(!"1.0".equals(e.specversion())) throw ApiProblem.invalid("Event specversion must be 1.0");
        if(!"application/json".equalsIgnoreCase(e.datacontenttype())) throw ApiProblem.invalid("Event datacontenttype must be application/json");
        if(e.branchid()!=null && e.clinicid()==null) throw ApiProblem.invalid("branchid requires clinicid");
        if(!e.type().matches("^clinic\\.[a-z_]+\\.[a-z_]+\\.v[1-9][0-9]*$"))
            throw ApiProblem.invalid("Event type must match clinic.<domain>.<event>.vN");
        if(e.source().length()>120||e.subject().length()>180) throw ApiProblem.invalid("Event source/subject is too long");
        safe.validate(e.data());
    }
}
