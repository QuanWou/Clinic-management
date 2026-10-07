package com.clinic.catalog.api;

import com.clinic.catalog.api.CatalogDto.PublicOfferingView;
import com.clinic.catalog.service.CatalogService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/public/clinics/{clinicId}/branches/{branchId}/offerings")
public class PublicCatalogController{
  private final com.clinic.catalog.security.ClinicDirectoryClient publication;
  private final CatalogService service;
  public PublicCatalogController(CatalogService service,com.clinic.catalog.security.ClinicDirectoryClient publication){this.service=service;this.publication=publication;}
  @GetMapping
  public List<PublicOfferingView> list(@PathVariable UUID clinicId,@PathVariable UUID branchId){
    publication.requirePublishedBranch(clinicId,branchId);return service.publicOfferings(clinicId,branchId);
  }
}
