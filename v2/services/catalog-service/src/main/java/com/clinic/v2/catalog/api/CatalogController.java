package com.clinic.v2.catalog.api;

import com.clinic.v2.catalog.api.CatalogDto.*;
import com.clinic.v2.catalog.security.Actor;
import com.clinic.v2.catalog.service.CatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v2/clinics/{clinicId}")
public class CatalogController {
    private final CatalogService service;
    public CatalogController(CatalogService service){this.service=service;}

    @PostMapping("/offerings")
    @ResponseStatus(HttpStatus.CREATED)
    public OfferingView createOffering(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @Valid @RequestBody OfferingInput input){return service.createOffering(actor,clinicId,input);}

    @PutMapping("/offerings/{offeringId}")
    public OfferingView updateOffering(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
        @PathVariable UUID offeringId,@Valid @RequestBody OfferingUpdate input){
        return service.updateOffering(actor,clinicId,offeringId,input);
    }

    @GetMapping("/offerings")
    public List<OfferingView> offerings(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){
        return service.listOfferings(actor,clinicId);
    }

    @PostMapping("/branches/{branchId}/offerings")
    @ResponseStatus(HttpStatus.CREATED)
    public BranchOfferingView assign(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @Valid @RequestBody BranchOfferingInput input){return service.assignToBranch(actor,clinicId,branchId,input);}

    @PutMapping("/branches/{branchId}/offerings/{branchOfferingId}")
    public BranchOfferingView updateBranch(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID branchOfferingId,@Valid @RequestBody BranchOfferingUpdate input){
        return service.updateBranchOffering(actor,clinicId,branchId,branchOfferingId,input);
    }

    @GetMapping("/branches/{branchId}/offerings")
    public List<BranchOfferingView> branchOfferings(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId){
        return service.listBranchOfferings(actor,clinicId,branchId);
    }

    @PostMapping("/branches/{branchId}/price-versions")
    @ResponseStatus(HttpStatus.CREATED)
    public PriceVersionView price(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @Valid @RequestBody PriceVersionInput input){return service.createPriceVersion(actor,clinicId,branchId,input);}

    @GetMapping("/branches/{branchId}/offerings/{offeringId}/price-versions")
    public List<PriceVersionView> history(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID offeringId){return service.priceHistory(actor,clinicId,branchId,offeringId);}

    @GetMapping("/branches/{branchId}/offerings/{offeringId}/price-snapshot")
    public PriceSnapshot snapshot(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID offeringId,@RequestParam(required=false) Instant at){
        return service.snapshot(actor,clinicId,branchId,offeringId,at);
    }
}
