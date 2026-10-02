package com.clinic.v2.doctor.api;

import com.clinic.v2.doctor.api.DoctorDto.PublicDoctorView;
import com.clinic.v2.doctor.service.DoctorService;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v2/public/clinics/{clinicId}/branches/{branchId}/doctors")
public class PublicDoctorController {
  private final com.clinic.v2.doctor.security.ClinicDirectoryClient publication;
    private final DoctorService service;
    private final com.clinic.v2.doctor.service.AbsenceService absences;
    public PublicDoctorController(DoctorService service,com.clinic.v2.doctor.security.ClinicDirectoryClient publication,com.clinic.v2.doctor.service.AbsenceService absences){this.service=service;this.publication=publication;this.absences=absences;}
    public record AvailabilityDoctor(UUID practitionerId,UUID clinicId,UUID branchId,String displayName,String specialtyCode,String specialtyName,String professionalTitle,long affiliationVersion,List<com.clinic.v2.doctor.api.DoctorDto.PublicScheduleView> schedules,List<com.clinic.v2.doctor.service.AbsenceService.Window> absences){}
    @GetMapping
    public List<AvailabilityDoctor> list(@PathVariable UUID clinicId,@PathVariable UUID branchId){
        publication.requirePublishedBranch(clinicId,branchId);return service.publicDoctors(clinicId,branchId).stream().map(d->new AvailabilityDoctor(d.practitionerId(),clinicId,branchId,d.displayName(),d.specialtyCode(),d.specialtyName(),d.professionalTitle(),d.affiliationVersion(),d.schedules(),absences.windows(clinicId,branchId,d.practitionerId()))).toList();
    }
}
