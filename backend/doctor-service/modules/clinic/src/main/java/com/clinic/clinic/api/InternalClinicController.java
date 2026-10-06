package com.clinic.clinic.api;

import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.security.ClinicWorkloadTokenVerifier;
import com.clinic.clinic.service.ClinicOnboardingService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/internal/clinics")
public class InternalClinicController {
    private final ClinicOnboardingService service;
    private final ClinicWorkloadTokenVerifier workloads;

    public InternalClinicController(ClinicOnboardingService service,ClinicWorkloadTokenVerifier workloads){
        this.service=service;this.workloads=workloads;
    }

    @GetMapping("/{clinicId}/scope")
    public ScopeValidation scope(@PathVariable UUID clinicId,
            @RequestParam(required=false) String branchIds,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        requireAny(bearer,"clinic.scope.read","identity-service","doctor-service","catalog-service","patient-service","encounter-service");
        Set<UUID> requested=parse(branchIds);
        return service.scopeValidation(clinicId,requested);
    }

    @GetMapping("/{clinicId}/booking-eligibility")
    public BookingEligibility eligibility(@PathVariable UUID clinicId,@RequestParam UUID branchId,
            @RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer){
        require(bearer,"clinic.booking.read","appointment-service");
        return service.bookingEligibility(clinicId,branchId);
    }

    private void require(String bearer,String scope,String subject){
        if(workloads.verify(bearer,scope,subject)==null) throw ApiProblem.forbidden();
    }
    private void requireAny(String bearer,String scope,String... issuers){
        if(workloads.verifyAny(bearer,scope,issuers)==null) throw ApiProblem.forbidden();
    }
    private Set<UUID> parse(String raw){
        if(raw==null || raw.isBlank()) return Set.of();
        Set<UUID> result=new LinkedHashSet<>();
        for(String item:raw.split(",")) {
            try { result.add(UUID.fromString(item.trim())); }
            catch(IllegalArgumentException ex){ throw ApiProblem.invalid("Invalid branch UUID"); }
        }
        return Set.copyOf(result);
    }
}
