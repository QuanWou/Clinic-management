package com.clinic.audit.service;

import com.clinic.audit.api.ApiProblem;
import com.clinic.audit.api.AuditDto.EventEnvelopeInput;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class EventEnvelopeValidatorTest {
    private final EventEnvelopeValidator validator=new EventEnvelopeValidator(new SafeMetadata());

    private EventEnvelopeInput envelope(Map<String,Object> data){
        return new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/doctor",
            "clinic.doctor.schedule_changed.v1","doctor-affiliation/"+UUID.randomUUID(),
            Instant.now(),"application/json",UUID.randomUUID(),UUID.randomUUID(),
            UUID.randomUUID().toString(),null,1,data);
    }

    @Test void safeReferenceMetadataIsAccepted(){
        assertDoesNotThrow(()->validator.validate(envelope(Map.of(
            "doctorRef",UUID.randomUUID().toString(),
            "scheduleVersion",3,
            "state","ACTIVE"
        ))));
    }

    @Test void diagnosisAndContactFieldsAreRejected(){
        assertThrows(ApiProblem.class,()->validator.validate(envelope(Map.of("diagnosis","secret"))));
        assertThrows(ApiProblem.class,()->validator.validate(envelope(Map.of("patientEmail","x@example.test"))));
        assertThrows(ApiProblem.class,()->validator.validate(envelope(Map.of("clinical_note","free text"))));
    }

    @Test void branchRequiresClinicAndTypeMustBeVersioned(){
        var noClinic=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/doctor",
            "clinic.doctor.schedule_changed.v1","doctor/x",Instant.now(),"application/json",
            null,UUID.randomUUID(),"trace",null,1,Map.of("doctorRef","x"));
        assertThrows(ApiProblem.class,()->validator.validate(noClinic));

        var wrongType=new EventEnvelopeInput("1.0",UUID.randomUUID(),"/services/doctor",
            "doctor.changed","doctor/x",Instant.now(),"application/json",
            UUID.randomUUID(),null,"trace",null,1,Map.of("doctorRef","x"));
        assertThrows(ApiProblem.class,()->validator.validate(wrongType));
    }
}
