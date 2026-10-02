package com.clinic.v2.iam.api;

import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.security.Actor;
import com.clinic.v2.iam.service.MembershipService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v2/me")
public class MeContextController {
  private final MembershipService service;
  public MeContextController(MembershipService service){this.service=service;}

  @GetMapping("/contexts")
  public List<ContextSummary> contexts(@AuthenticationPrincipal Actor actor){return service.contexts(actor);}

  @GetMapping("/context")
  public ClinicContext context(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId,@RequestParam UUID branchId){
    return service.resolve(actor,clinicId,branchId);
  }

  @PostMapping("/contexts/claim-owner")
  public MembershipView claimOwner(@AuthenticationPrincipal Actor actor,@RequestParam UUID clinicId){
    return service.claimPrimaryOwner(actor,clinicId);
  }

  @GetMapping("/platform-grants")
  public List<PlatformGrantView> platformGrants(@AuthenticationPrincipal Actor actor){return service.myPlatformGrants(actor);}
}
