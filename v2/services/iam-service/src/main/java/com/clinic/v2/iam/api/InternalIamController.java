package com.clinic.v2.iam.api;

import com.clinic.v2.iam.api.IamDto.*;
import com.clinic.v2.iam.security.WorkloadTokenVerifier;
import com.clinic.v2.iam.service.MembershipService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/internal/iam")
public class InternalIamController {
  private final MembershipService service;
  private final WorkloadTokenVerifier workloads;
  public InternalIamController(MembershipService service,WorkloadTokenVerifier workloads){
    this.service=service;this.workloads=workloads;
  }

  @PostMapping("/authorization/check")
  public AuthorizationResult authorize(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
      @Valid @RequestBody AuthorizationRequest input){
    require(bearer,"iam.authorize","clinic-service");
    return service.authorizeInternal(input);
  }

  @PostMapping("/owners")
  @ResponseStatus(HttpStatus.CREATED)
  public MembershipView provisionOwner(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
      @Valid @RequestBody OwnerProvisionRequest input){
    var w=require(bearer,"iam.owner.provision","clinic-service");
    return service.provisionOwner(w.subject(),input);
  }

  @PostMapping("/platform-grants")
  public PlatformGrantView grantPlatform(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
      @Valid @RequestBody PlatformGrantInput input){
    var w=require(bearer,"iam.platform.bootstrap","platform-bootstrap");
    return service.grantPlatform(w.subject(),input);
  }

  @PostMapping("/platform-grants/revoke")
  public PlatformGrantView revokePlatform(@RequestHeader(value=HttpHeaders.AUTHORIZATION,required=false) String bearer,
      @Valid @RequestBody PlatformGrantInput input){
    var w=require(bearer,"iam.platform.bootstrap","platform-bootstrap");
    return service.revokePlatform(w.subject(),input);
  }

  private WorkloadTokenVerifier.Workload require(String bearer,String scope,String expectedSubject){
    var w=workloads.verify(bearer,scope);
    if(w==null || !expectedSubject.equals(w.subject())) throw ApiProblem.forbidden();
    return w;
  }
}
