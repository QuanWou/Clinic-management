package com.clinic.billing.api;
import com.clinic.billing.api.BillingDto.*;
import com.clinic.billing.security.Actor;
import com.clinic.billing.service.BillingService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/clinics/{clinicId}/branches/{branchId}")
public class BillingController {
 private final BillingService service;public BillingController(BillingService service){this.service=service;}
 @GetMapping("/bills") public List<Bill> bills(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId){return service.list(a,clinicId,branchId);}
 @GetMapping("/bills/{id}") public Bill read(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return service.read(a,clinicId,branchId,id);}
 @GetMapping("/bills/{id}/notification-deliveries") public BillingService.NotificationState notifications(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return service.notifications(a,clinicId,branchId,id);}
 public record NotificationRetry(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=500) String reason){}
 @PostMapping("/bills/{id}/notification-deliveries/retry") public BillingService.NotificationState retry(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody NotificationRetry in){return service.retryNotifications(a,clinicId,branchId,id,key,in.reason());}
 @PostMapping("/bills") public Bill issue(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody IssueInput in){return service.issue(a,clinicId,branchId,key,in);}
 @GetMapping("/bills/{id}/payments") public List<Receipt> payments(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id){return service.payments(a,clinicId,branchId,id);}
 @PostMapping("/bills/{id}/payments") public Receipt collect(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody PaymentInput in){return service.collect(a,clinicId,branchId,id,key,in);}
 @PostMapping("/bills/{id}/adjustments") public Bill adjust(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AdjustmentInput in){return service.adjust(a,clinicId,branchId,id,key,in);}
 @GetMapping("/collection-shifts") public List<Shift> shifts(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId){return service.shifts(a,clinicId,branchId);}
 @PostMapping("/collection-shifts") public Shift open(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ShiftInput in){return service.open(a,clinicId,branchId,key,in);}
 @PostMapping("/collection-shifts/{id}/submit") public Shift submit(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ShiftSubmit in){return service.submit(a,clinicId,branchId,id,key,in);}
 @PostMapping("/collection-shifts/{id}/approve") public Shift approve(@AuthenticationPrincipal Actor a,@PathVariable UUID clinicId,@PathVariable UUID branchId,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ApproveInput in){return service.approve(a,clinicId,branchId,id,key,in);}
}
