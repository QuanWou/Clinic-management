package com.clinic.v2.iam.api;

import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.security.Actor;
import com.clinic.v2.iam.service.MembershipService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class MembershipAdminController {
  private final MembershipService service;
  public MembershipAdminController(MembershipService service){this.service=service;}

  @GetMapping("/api/v2/clinics/{clinicId}/memberships")
  public List<MembershipView> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId){
    return service.listClinic(actor,clinicId);
  }

  @PostMapping("/api/v2/clinics/{clinicId}/memberships")
  @ResponseStatus(HttpStatus.CREATED)
  public MembershipView create(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,
      @Valid @RequestBody MembershipInput input){
    if(!clinicId.equals(input.clinicId())) throw ApiProblem.invalid("Path clinic and payload clinic must match");
    return service.create(actor,input);
  }

  @PutMapping("/api/v2/memberships/{membershipId}/scope")
  public MembershipView scope(@AuthenticationPrincipal Actor actor,@PathVariable UUID membershipId,
      @Valid @RequestBody BranchScopeInput input){
    return service.updateScope(actor,membershipId,input);
  }

  @PostMapping("/api/v2/memberships/{membershipId}/revoke")
  public MembershipView revoke(@AuthenticationPrincipal Actor actor,@PathVariable UUID membershipId,
      @Valid @RequestBody RevokeInput input){
    return service.revoke(actor,membershipId,input);
  }
}
