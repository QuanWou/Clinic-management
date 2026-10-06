package com.clinic.billing;
import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
class ChargeSourceClientTest{
 HttpServer server;String url;String secret="synthetic-charge-source-http-secret-at-least-32-bytes";ObjectMapper json=new ObjectMapper().findAndRegisterModules();
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),encounter=UUID.randomUUID(),patient=UUID.randomUUID(),order=UUID.randomUUID(),offering=UUID.randomUUID(),booking=UUID.randomUUID();
 BillingSources.Snapshot price=new BillingSources.Snapshot(UUID.randomUUID(),100000,"VND",Instant.now().minusSeconds(100),null,null);AtomicReference<String> bad=new AtomicReference<>("");AtomicReference<String> contractFailure=new AtomicReference<>();
 @BeforeEach void start()throws Exception{server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",exchange->{try{
  var claims=Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).requireIssuer("billing-service").build().parseSignedClaims(exchange.getRequestHeaders().getFirst("Authorization").substring(7)).getPayload();if(!((Collection<?>)claims.get("scopes")).equals(List.of("billing.source.sync"))||exchange.getRequestHeaders().getFirst("X-Actor-User-Id")!=null)throw new IllegalStateException("Wrong system proof scope/actor authority");
  String path=exchange.getRequestURI().getPath();if(!path.startsWith("/api/internal/clinics/"+clinic+"/branches/"+branch+"/")||!path.endsWith("/billing-sync-proof"))throw new IllegalStateException("Lost source branch/path scope");
  UUID provenPatient="PATIENT".equals(bad.get())?UUID.randomUUID():patient;Object body;
  if(claims.getAudience().contains("encounter-service"))body=new BillingSources.Visit(encounter,clinic,branch,patient,booking,"CLINICALLY_COMPLETED",7);
  else if(claims.getAudience().contains("appointment-service"))body=new BillingSources.AppointmentProof(booking,clinic,branch,provenPatient,encounter,offering,"AP-SYN","FULFILLED",price);
  else if(claims.getAudience().contains("medical-service")&&path.contains("/orders/"))body=new ChargeSourceClient.ReviewedOrder(encounter,clinic,"BRANCH".equals(bad.get())?UUID.randomUUID():branch,patient,"VERSION".equals(bad.get())?3:7,order,offering,"Synthetic frozen service",price,"REVIEWED");
  else if(claims.getAudience().contains("medical-service"))body=new BillingSources.MedicalProof(encounter,clinic,branch,provenPatient,"VERSION".equals(bad.get())?8:7,"VALIDATED",List.of(new BillingSources.Order(order,offering,"Synthetic frozen service",price)));
  else throw new IllegalStateException("Wrong source audience");
  byte[] bytes=json.writeValueAsBytes(body);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);
 }catch(Exception ex){contractFailure.set(ex.getClass().getSimpleName());exchange.sendResponseHeaders(500,-1);}finally{exchange.close();}});server.start();url="http://127.0.0.1:"+server.getAddress().getPort();}
 @AfterEach void stop(){server.stop(0);}
 ChargeSourceClient client(){return new ChargeSourceClient(url,url,url,secret);}
 @Test void reviewedAndCompletedSourceHttpProofsBindFrozenMedicalAndBookingSnapshots(){
  var client=client();var reviewed=client.reviewed(clinic,branch,encounter,order,4);assertEquals(1,reviewed.size());assertEquals("MEDICAL_ORDER",reviewed.getFirst().sourceType());assertEquals(price,reviewed.getFirst().price());var complete=client.completed(clinic,branch,encounter,patient);assertEquals(2,complete.size());assertEquals(Set.of("MEDICAL_ORDER","APPOINTMENT"),complete.stream().map(BillingSources.Charge::sourceType).collect(java.util.stream.Collectors.toSet()));assertNull(contractFailure.get());
 }
 @Test void mismatchedSourceBranchPatientVersionAndNetworkOutageFailWithoutProof(){
  var client=client();bad.set("BRANCH");assertThrows(ApiProblem.class,()->client.reviewed(clinic,branch,encounter,order,4));bad.set("VERSION");assertThrows(ApiProblem.class,()->client.reviewed(clinic,branch,encounter,order,4));assertThrows(ApiProblem.class,()->client.completed(clinic,branch,encounter,patient));bad.set("PATIENT");assertThrows(ApiProblem.class,()->client.completed(clinic,branch,encounter,patient));assertNull(contractFailure.get());server.stop(0);assertThrows(ApiProblem.class,()->client.reviewed(clinic,branch,encounter,order,4));
 }
}
