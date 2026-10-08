package com.clinic.encounter.api;
import com.clinic.encounter.security.Actor;
import com.clinic.encounter.service.AdminPatientHistoryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController
@RequestMapping("/api/clinics/{clinicId}/branches/{branchId}/admin/patients/{patientId}/visits")
public class AdminPatientHistoryController {
 private final AdminPatientHistoryService service;
 public AdminPatientHistoryController(AdminPatientHistoryService service){this.service=service;}
 @GetMapping public AdminPatientHistoryService.Page list(@AuthenticationPrincipal Actor actor,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID patientId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.list(actor,clinicId,branchId,patientId,page,size);}
}
