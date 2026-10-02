package com.clinic.v2.medical.api;
import com.clinic.v2.medical.api.MedicalDto.*;
import com.clinic.v2.medical.security.Actor;
import com.clinic.v2.medical.service.MedicalService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/v2/clinics/{clinicId}/branches/{branchId}")
public class MedicalController{
 private final MedicalService s;public MedicalController(MedicalService s){this.s=s;}
 @GetMapping("/visits/{id}/draft") public DraftView draft(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return s.draft(a,clinicId,branchId,id);}
 @PutMapping("/visits/{id}/draft") public DraftView save(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody DraftInput in){return s.save(a,clinicId,branchId,id,key,in);}
 @GetMapping("/visits/{id}/orders") public List<OrderView> orders(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return s.orders(a,clinicId,branchId,id);}
 @PostMapping("/visits/{id}/orders") public OrderView order(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody OrderInput in){return s.order(a,clinicId,branchId,id,key,in);}
 @GetMapping("/lab/orders") public List<OrderView> lab(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId){return s.lab(a,clinicId,branchId);}
 @PostMapping("/orders/{id}/{action:accept|process|reject|cancel}") public OrderView transition(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@PathVariable String action,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Transition in){return s.transition(a,clinicId,branchId,id,action,key,in);}
 @PostMapping("/orders/{id}/results") public OrderView result(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ResultInput in){return s.result(a,clinicId,branchId,id,key,in);}
 @PostMapping("/orders/{id}/reviews") public OrderView review(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ReviewInput in){return s.review(a,clinicId,branchId,id,key,in);}
 @PostMapping("/visits/{id}/validate") public DraftView validate(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Transition in){return s.validate(a,clinicId,branchId,id,key,in);}
 @GetMapping("/visits/{id}/readiness") public MedicalService.Readiness readiness(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return s.readiness(a,clinicId,branchId,id);}
}
