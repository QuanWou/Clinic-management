package com.clinic.billing.api;

import com.clinic.billing.security.Actor;
import com.clinic.billing.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.util.MultiValueMap;
import java.util.*;

@RestController
public class OnlinePaymentController {
 private final OnlinePaymentService service;private final PaymentGateways gateways;private final BillingService billing;
 public OnlinePaymentController(OnlinePaymentService service,PaymentGateways gateways,BillingService billing){this.service=service;this.gateways=gateways;this.billing=billing;}
 private static final String ROOT="/api/me/clinics/{c}/branches/{b}/bills/{bill}";
 @GetMapping(ROOT+"/payment-methods") public List<PaymentGateways.Method> methods(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill){return service.methods(actor,c,b,bill);}
 @GetMapping(ROOT+"/bank-transfer") public PaymentGateways.BankDetails bank(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill){return service.bank(actor,c,b,bill);}
 @GetMapping(ROOT+"/payment-intents") public List<OnlinePaymentService.Intent> list(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill){return service.list(actor,c,b,bill);}
 @GetMapping("/api/clinics/{c}/branches/{b}/bills/{bill}/online-payments") public List<OnlinePaymentService.Intent> staff(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill){billing.read(actor,c,b,bill);return service.staffList(c,b,bill);}
 @PostMapping(ROOT+"/payment-intents") public OnlinePaymentService.Intent create(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill,@RequestHeader("Idempotency-Key") String key,@RequestBody OnlinePaymentService.Create input,HttpServletRequest req){return service.create(actor,c,b,bill,key,input,req.getRemoteAddr());}
 @GetMapping(ROOT+"/payment-intents/{id}") public OnlinePaymentService.Intent read(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill,@PathVariable UUID id,@RequestParam(defaultValue="false") boolean reconcile){return service.read(actor,c,b,bill,id,reconcile);}
 @PostMapping(ROOT+"/payment-intents/{id}/cancel") public OnlinePaymentService.Intent cancel(@AuthenticationPrincipal Actor actor,@PathVariable UUID c,@PathVariable UUID b,@PathVariable UUID bill,@PathVariable UUID id,@RequestHeader("Idempotency-Key") String key){return service.cancel(actor,c,b,bill,id,key);}
 @PostMapping("/api/public/payments/clinics/{c}/branches/{b}/payos/webhook") public Map<String,Object> webhook(@PathVariable UUID c,@PathVariable UUID b,@RequestBody JsonNode body){var evidence=gateways.webhook(body);return Map.of("received",true,"status",service.confirm(c,b,"PAYOS",evidence));}
 @GetMapping("/api/public/payments/clinics/{c}/branches/{b}/vnpay/ipn") public Map<String,String> ipn(@PathVariable UUID c,@PathVariable UUID b,@RequestParam MultiValueMap<String,String> params){
  if(params.values().stream().anyMatch(v->v.size()!=1))return ack("97","Invalid signature");var values=params.toSingleValueMap();if(!gateways.validVnpay(values))return ack("97","Invalid signature");
  try{return switch(service.confirm(c,b,"VNPAY",gateways.vnpay(values))){case "PAID","FAILED"->ack("00","Confirm Success");case "ALREADY_PAID","REVIEW_REQUIRED"->ack("02","Order already confirmed or requires review");case "MISMATCH"->ack("04","Invalid amount");default->ack("01","Order not found");};}catch(ApiProblem e){return ack("99","Confirmation unavailable");}
 }
 private static Map<String,String> ack(String code,String message){return Map.of("RspCode",code,"Message",message);}
}
