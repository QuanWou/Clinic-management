package com.clinic.v2.search.api;

import com.clinic.v2.search.api.SearchDto.*;
import com.clinic.v2.search.service.SearchProjectionService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v2/public")
public class PublicSearchController{
  private final SearchProjectionService service;
  public PublicSearchController(SearchProjectionService service){this.service=service;}

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
}
