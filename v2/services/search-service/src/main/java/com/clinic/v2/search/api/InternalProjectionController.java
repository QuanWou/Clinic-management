package com.clinic.v2.search.api;

import com.clinic.v2.search.api.SearchDto.*;
import com.clinic.v2.search.security.WorkloadPrincipal;
import com.clinic.v2.search.service.SearchProjectionService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/internal/projections")
public class InternalProjectionController{
  private final SearchProjectionService service;
  private final com.clinic.v2.search.service.ProjectionSnapshotService snapshots;
  public InternalProjectionController(SearchProjectionService service,com.clinic.v2.search.service.ProjectionSnapshotService snapshots){this.service=service;this.snapshots=snapshots;}

  @PostMapping("/snapshot")
  public ProjectionResult snapshot(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody com.clinic.v2.search.service.ProjectionSnapshotService.Delivery in){
    return snapshots.accept(p,in);
  }

  @PostMapping("/clinic")
  public ProjectionResult clinic(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody ClinicProjectionInput in){
    requireIssuer(p,"clinic-v2-service");return service.projectClinic(in);
  }
  @PostMapping("/doctor")
  public ProjectionResult doctor(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody DoctorProjectionInput in){
    requireIssuer(p,"doctor-v2-service");return service.projectDoctor(in);
  }
  @PostMapping("/offering")
  public ProjectionResult offering(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody OfferingProjectionInput in){
    requireIssuer(p,"catalog-v2-service");return service.projectOffering(in);
  }
  private void requireIssuer(WorkloadPrincipal p,String issuer){
    if(p==null||!p.hasScope("search.project")||!issuer.equals(p.issuer()))throw ApiProblem.forbidden();
  }
}
