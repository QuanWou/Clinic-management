package com.clinic.clinic.api;

import com.clinic.clinic.api.ClinicDto.PublicView;
import com.clinic.clinic.service.ClinicOnboardingService;
import org.springframework.data.domain.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/clinics")
public class PublicClinicController {
    private final ClinicOnboardingService service;
    public PublicClinicController(ClinicOnboardingService service){this.service=service;}
    @GetMapping
    public Page<PublicView> search(@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size){
        return service.publicList(PageRequest.of(Math.max(0,page),Math.max(1,Math.min(50,size))));
    }
    @GetMapping("/{slug}")
    public PublicView detail(@PathVariable String slug){return service.publicBySlug(slug);}
    @GetMapping("/by-id/{id}")
    public PublicView byId(@PathVariable java.util.UUID id){return service.publicById(id);}
}
