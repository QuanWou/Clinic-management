package com.clinic.search.api;

import com.clinic.search.api.SearchDto.*;
import com.clinic.search.security.WorkloadPrincipal;
import com.clinic.search.service.SearchProjectionService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/projections")
public class InternalProjectionController{
  private final SearchProjectionService service;
  private final com.clinic.search.service.ProjectionSnapshotService snapshots;
  public InternalProjectionController(SearchProjectionService service,com.clinic.search.service.ProjectionSnapshotService snapshots){this.service=service;this.snapshots=snapshots;}

  @PostMapping("/snapshot")
  public ProjectionResult snapshot(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody com.clinic.search.service.ProjectionSnapshotService.Delivery in){
    return snapshots.accept(p,in);
  }

  @PostMapping("/clinic")
  public ProjectionResult clinic(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody ClinicProjectionInput in){
    requireIssuer(p,"clinic-service");return service.projectClinic(in);
  }
  @PostMapping("/doctor")
  public ProjectionResult doctor(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody DoctorProjectionInput in){
    requireIssuer(p,"doctor-service");return service.projectDoctor(in);
  }
  @PostMapping("/offering")
  public ProjectionResult offering(@AuthenticationPrincipal WorkloadPrincipal p,@Valid @RequestBody OfferingProjectionInput in){
    requireIssuer(p,"catalog-service");return service.projectOffering(in);
  }
  private void requireIssuer(WorkloadPrincipal p,String issuer){
    if(p==null||!p.hasScope("search.project")||!issuer.equals(p.issuer()))throw ApiProblem.forbidden();
  }
}
