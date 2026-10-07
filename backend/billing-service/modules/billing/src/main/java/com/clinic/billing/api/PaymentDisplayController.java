package com.clinic.billing.api;

import com.clinic.billing.security.Actor;
import com.clinic.billing.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class PaymentDisplayController {
 private final PaymentDisplayService displays;private final BillingService billing;private final OnlinePaymentService online;
 public PaymentDisplayController(PaymentDisplayService displays,BillingService billing,OnlinePaymentService online){this.displays=displays;this.billing=billing;this.online=online;}

 @GetMapping("/api/clinics/{c}/branches/{b}/bills/{bill}/payment-methods")
 public java.util.List<PaymentGateways.Method> staffMethods(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill){
  billing.authorizeBilling(actor,c,b);billing.read(actor,c,b,bill);return online.staffMethods(c,b,bill);
 }

 @PostMapping("/api/clinics/{c}/branches/{b}/bills/{bill}/payment-display")
 public PaymentDisplayService.Launch launch(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill,
  @RequestHeader("Idempotency-Key") String key,@RequestBody PaymentDisplayService.Create input,HttpServletRequest request){
  return displays.create(actor,c,b,bill,key,input,request);
 }

 @GetMapping("/api/public/payment-displays/{token}")
 public PaymentDisplayService.View read(@PathVariable String token){return displays.read(token);}
}
