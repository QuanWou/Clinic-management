package com.clinic.billing;

import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.clinic.billing.service.PaymentConfiguration.*;

class PaymentGatewaysTest {
 private final UUID clinic=UUID.fromString("00000000-0000-0000-0000-000000000001");private final ObjectMapper json=new ObjectMapper();
 private PaymentGateways gateway(){return new PaymentGateways(new Settings(true,clinic,"http://localhost:4176",new Payos("synthetic-client","synthetic-key","synthetic-checksum","https://api-merchant.payos.vn"),new Vnpay("TMNTEST1","synthetic-vnpay-key","https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),new Bank("970436","Vietcombank","1234567890","NGUYEN VAN A")),json);}
 @Test void webhookVerifiesIndependentKnownVectorAndRejectsTamperedAmounts()throws Exception{
  var body=json.readTree("{\"data\":{\"amount\":100000,\"code\":\"00\",\"currency\":\"VND\",\"orderCode\":123456,\"paymentLinkId\":\"link-test\",\"reference\":\"TX-1\"},\"signature\":\"21c671208621583cbc1d93f730b7370c06038cfeb123a55064fc2afb42914223\"}");
  var gateway=gateway();assertEquals(100000,gateway.webhook(body).amountVnd());((com.fasterxml.jackson.databind.node.ObjectNode)body.path("data")).put("amount",100001);assertThrows(ApiProblem.class,()->gateway.webhook(body));
 }
 @Test void unconfiguredGatewaysAndAnotherClinicNeverExposePaymentChoices(){
  assertTrue(gateway().methods(clinic).getFirst().available());assertFalse(gateway().methods(UUID.randomUUID()).getFirst().available());assertThrows(ApiProblem.class,()->gateway().require(UUID.randomUUID(),"VNPAY"));
  var disabled=new PaymentGateways(new Settings(false,clinic,"http://localhost:4176",new Payos("","","","https://api-merchant.payos.vn"),new Vnpay("","","https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),new Bank("970436","VCB","1234567890","")),json);
  assertEquals(1,disabled.methods(clinic).stream().filter(PaymentGateways.Method::available).count());assertTrue(disabled.methods(clinic).getLast().available());
 }
 @Test void vnpayEncodesVndMinorUnitsAndSignsOnlyVnpParameters(){
  var gateway=gateway();var link=gateway.create(clinic,UUID.randomUUID(),UUID.randomUUID(),"VNPAY","invoice123",180000,Instant.now().plusSeconds(900),"192.0.2.1");var uri=URI.create(link.checkoutUrl());var params=new LinkedHashMap<String,String>();for(String part:uri.getRawQuery().split("&")){String[] pair=part.split("=",2);params.put(URLDecoder.decode(pair[0],java.nio.charset.StandardCharsets.UTF_8),URLDecoder.decode(pair[1],java.nio.charset.StandardCharsets.UTF_8));}
  assertEquals("18000000",params.get("vnp_Amount"));assertEquals("2.1.0",params.get("vnp_Version"));assertEquals("VND",params.get("vnp_CurrCode"));assertEquals("192.0.2.1",params.get("vnp_IpAddr"));assertTrue(gateway.validVnpay(params));params.put("tracking","irrelevant");assertTrue(gateway.validVnpay(params));params.put("vnp_Amount","1");assertFalse(gateway.validVnpay(params));
 }
 @Test void vnpayRequiresSuccessStatusMerchantAndWholeVnd(){
  var gateway=gateway();var params=new HashMap<String,String>(Map.of("vnp_TmnCode","TMNTEST1","vnp_Amount","10000000","vnp_TxnRef","ref","vnp_TransactionNo","transaction1","vnp_ResponseCode","00","vnp_TransactionStatus","00"));sign(params);assertTrue(gateway.vnpay(params).paid());
  params.put("vnp_TransactionStatus","02");sign(params);assertFalse(gateway.vnpay(params).paid());params.put("vnp_Amount","10000001");sign(params);assertThrows(ApiProblem.class,()->gateway.vnpay(params));params.put("vnp_TmnCode","OTHER123");sign(params);assertFalse(gateway.validVnpay(params));
 }
 private void sign(Map<String,String> data){data.remove("vnp_SecureHash");data.put("vnp_SecureHash",PaymentGateways.hmac("HmacSHA512","synthetic-vnpay-key",PaymentGateways.query(data)));}
 @Test void qrContainsExactInvoiceAmountAndOnlyAdministrativeReference(){var bank=gateway().bank(clinic,UUID.fromString("fedcba98-1234-4567-89ab-123456789012"),180000);assertEquals(180000,bank.amountVnd());assertTrue(bank.qrUrl().contains("amount=180000"));assertEquals("PKFEDCBA981234456789AB",bank.content());assertTrue(bank.qrUrl().contains("NGUYEN+VAN+A"));assertFalse(bank.qrUrl().contains("patient"));}
}
