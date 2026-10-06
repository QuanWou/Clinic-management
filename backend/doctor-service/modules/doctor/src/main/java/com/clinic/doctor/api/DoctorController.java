package com.clinic.doctor.api;

import com.clinic.doctor.api.DoctorDto.*;
import com.clinic.doctor.security.Actor;
import com.clinic.doctor.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/clinics/{clinicId}/branches/{branchId}")
public class DoctorController {
    private final DoctorService service;
    public DoctorController(DoctorService service){this.service=service;}

    @PostMapping("/doctor-affiliations")
    @ResponseStatus(HttpStatus.CREATED)
    public AffiliationView create(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @Valid @RequestBody AffiliationInput input){return service.createAffiliation(actor,clinicId,branchId,input);}

    @PutMapping("/doctor-affiliations/{affiliationId}")
    public AffiliationView update(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID affiliationId,@Valid @RequestBody AffiliationUpdate input){
        return service.updateAffiliation(actor,clinicId,branchId,affiliationId,input);
    }

    @GetMapping("/doctor-affiliations")
    public List<AffiliationView> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId){
        return service.listAffiliations(actor,clinicId,branchId);
    }

    @PostMapping("/doctor-affiliations/{affiliationId}/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleView createSchedule(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID affiliationId,@Valid @RequestBody ScheduleInput input){
        return service.createSchedule(actor,clinicId,branchId,affiliationId,input);
    }

    @PutMapping("/doctor-affiliations/{affiliationId}/schedules/{scheduleId}")
    public ScheduleView updateSchedule(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID affiliationId,@PathVariable UUID scheduleId,@Valid @RequestBody ScheduleUpdate input){
        return service.updateSchedule(actor,clinicId,branchId,affiliationId,scheduleId,input);
    }

    @GetMapping("/doctor-affiliations/{affiliationId}/schedules")
    public DoctorScheduleView schedules(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,
        @PathVariable UUID affiliationId){return service.schedules(actor,clinicId,branchId,affiliationId);}
}
