package com.clinic.clinic.api;

import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.domain.ReviewStatus;
import com.clinic.clinic.security.Actor;
import com.clinic.clinic.service.ClinicOnboardingService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/platform/clinics")
public class PlatformClinicController {
    private final ClinicOnboardingService service;
    public PlatformClinicController(ClinicOnboardingService service){this.service=service;}

    @GetMapping("/capabilities")
    public ClinicOnboardingService.PlatformCapabilities capabilities(@AuthenticationPrincipal Actor actor){
        return service.platformCapabilities(actor);
    }

    @GetMapping
    public Page<OwnerView> submissions(@AuthenticationPrincipal Actor actor,
        @RequestParam(defaultValue="SUBMITTED") ReviewStatus status,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        return service.submissions(actor,status,PageRequest.of(Math.max(0,page),Math.max(1,Math.min(50,size))));
    }
    @GetMapping("/{clinicId}")
    public OwnerView detail(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){
        return service.owned(actor,clinicId);
    }
    @PostMapping("/{clinicId}/request-changes")
    public OwnerView needsChanges(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody ReasonInput input){return service.needsChanges(actor,clinicId,input);}
    @PostMapping("/{clinicId}/reject")
    public OwnerView reject(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody ReasonInput input){return service.reject(actor,clinicId,input);}
    @PostMapping("/{clinicId}/approve")
    public OwnerView approve(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody DecisionInput input){return service.approve(actor,clinicId,input);}
    @PostMapping("/{clinicId}/publish")
    public OwnerView publish(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody ReasonInput input){return service.publish(actor,clinicId,input);}
    @PostMapping("/{clinicId}/unpublish")
    public OwnerView unpublish(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody ReasonInput input){return service.unpublish(actor,clinicId,input);}
    @PostMapping("/{clinicId}/suspend")
    public OwnerView suspend(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody ReasonInput input){return service.suspend(actor,clinicId,input);}
}
