package com.clinic.clinic.api;

import com.clinic.clinic.api.ClinicDto.*;
import com.clinic.clinic.security.Actor;
import com.clinic.clinic.security.IamAuthorizationClient;
import com.clinic.clinic.service.ClinicOnboardingService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/clinics")
public class OwnerClinicController {
    private final ClinicOnboardingService service;
    private final IamAuthorizationClient iam;
    public OwnerClinicController(ClinicOnboardingService service,IamAuthorizationClient iam){
        this.service=service;this.iam=iam;
    }

    @PostMapping
    public ResponseEntity<OwnerView> create(@AuthenticationPrincipal Actor actor,@Valid @RequestBody DraftInput input) {
        OwnerView created=service.create(actor,input); // local transaction commits before remote IAM call
        String membership="READY";
        try {
            iam.provisionOwner(actor.id(),created.id());
        } catch (ApiProblem ex) {
            // Clinic is already durable. Avoid an ambiguous POST retry that can collide on slug.
            membership="PENDING";
        }
        return ResponseEntity.status(HttpStatus.CREATED)
            .header("X-Owner-Membership",membership)
            .body(created);
    }

    @PostMapping("/{clinicId}/owner-membership")
    public ResponseEntity<Void> retryOwnerMembership(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId) {
        service.requireCreatorForBootstrap(actor,clinicId);
        iam.provisionOwner(actor.id(),clinicId);
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/mine")
    public List<OwnerView> mine(@AuthenticationPrincipal Actor actor){return service.mine(actor);}
    @GetMapping("/{clinicId}")
    public OwnerView get(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId) {
        return service.owned(actor,clinicId);
    }
    @PutMapping("/{clinicId}")
    public OwnerView update(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody DraftInput input){return service.update(actor,clinicId,input);}
    @PostMapping("/{clinicId}/branches")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnerView addBranch(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody BranchInput input){return service.addBranch(actor,clinicId,input);}
    @PutMapping("/{clinicId}/branches/{branchId}")
    public OwnerView updateBranch(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @PathVariable UUID branchId,@Valid @RequestBody BranchInput input){
        return service.updateBranch(actor,clinicId,branchId,input);
    }
    @PostMapping("/{clinicId}/submit")
    public OwnerView submit(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId) {
        return service.submit(actor,clinicId);
    }
    @GetMapping("/{clinicId}/reviews")
    public List<ReviewView> reviewHistory(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId) {
        return service.history(actor,clinicId);
    }
}
