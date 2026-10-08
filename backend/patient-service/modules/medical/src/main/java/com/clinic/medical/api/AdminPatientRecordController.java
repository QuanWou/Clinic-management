package com.clinic.medical.api;
import com.clinic.medical.security.Actor;
import com.clinic.medical.service.AdminPatientRecordService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/clinics/{clinicId}/branches/{branchId}/admin/patients/{patientId}/visits/{encounterId}/medical-record")
public class AdminPatientRecordController {
 private final AdminPatientRecordService service;
 public AdminPatientRecordController(AdminPatientRecordService service){this.service=service;}
 @GetMapping public AdminPatientRecordService.Record get(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID patientId,@PathVariable UUID encounterId){return service.get(actor,clinicId,branchId,patientId,encounterId);}
}
