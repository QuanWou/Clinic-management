package com.clinic.search.api;

import com.clinic.search.api.SearchDto.*;
import com.clinic.search.service.SearchProjectionService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/public")
public class PublicSearchController{
  private final SearchProjectionService service;
  private final com.clinic.search.service.PublicWebContentService content;
  public PublicSearchController(SearchProjectionService service,com.clinic.search.service.PublicWebContentService content){this.service=service;this.content=content;}

  @GetMapping("/search")
  public SearchResponse search(@RequestParam(required=false) String q,@RequestParam(defaultValue="20") int limit){
    return service.search(q,limit);
  }
  @GetMapping("/clinics/{clinicId}")
  public ClinicCard clinic(@PathVariable UUID clinicId){return service.clinic(clinicId);}
  @GetMapping("/clinics/{clinicId}/doctors")
  public List<DoctorView> doctors(@PathVariable UUID clinicId,@RequestParam(required=false) UUID branchId){return service.doctors(clinicId,branchId);}
  @GetMapping("/clinics/{clinicId}/offerings")
  public List<OfferingView> offerings(@PathVariable UUID clinicId,@RequestParam(required=false) UUID branchId){return service.offerings(clinicId,branchId);}
  @GetMapping("/clinics/{clinicId}/content")
  public com.fasterxml.jackson.databind.JsonNode content(@PathVariable UUID clinicId){return content.content(clinicId);}
  @GetMapping("/clinics/{clinicId}/specialties")
  public List<SpecialtyView> specialties(@PathVariable UUID clinicId,@RequestParam(required=false) UUID branchId){return service.specialties(clinicId,branchId);}
  @GetMapping("/clinics/{clinicId}/search")
  public ClinicSearchResponse clinicSearch(@PathVariable UUID clinicId,@RequestParam(required=false) UUID branchId,
      @RequestParam(required=false) String q,@RequestParam(defaultValue="20") int limit){
    return service.clinicSearch(clinicId,branchId,q,limit);
  }
}
