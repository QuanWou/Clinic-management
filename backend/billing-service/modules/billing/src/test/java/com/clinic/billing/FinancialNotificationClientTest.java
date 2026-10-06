package com.clinic.billing;
import com.clinic.billing.api.ApiProblem;
import com.clinic.billing.service.FinancialNotificationClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
class FinancialNotificationClientTest{
 HttpServer server;String url;final String secret="synthetic-financial-client-secret-at-least-32-bytes";ObjectMapper json=new ObjectMapper();UUID clinic=UUID.randomUUID(),patient=UUID.randomUUID(),user=UUID.randomUUID();AtomicReference<String> response=new AtomicReference<>();AtomicReference<String> failure=new AtomicReference<>();
 @BeforeEach void start()throws Exception{server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/",exchange->{try{
  String p=exchange.getRequestURI().getPath(),scope=p.contains("notification-recipients")?"patient.notification.recipient":"notification.billing.consume",aud=p.contains("notification-recipients")?"patient-service":"notification-service";
  var claims=Jwts.parser().verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).requireAudience(aud).requireIssuer("billing-service").build().parseSignedClaims(exchange.getRequestHeaders().getFirst("Authorization").substring(7)).getPayload();if(!((Collection<?>)claims.get("scopes")).contains(scope))throw new IllegalStateException("Missing exact scope");
  String body;if(p.contains("notification-recipients")){if(!p.endsWith("/clinics/"+clinic+"/patients/"+patient))throw new IllegalStateException("Recipient path lost source scope");body=response.get()==null?"{\"status\":\"OWNED\",\"userId\":\""+user+"\"}":response.get();}
  else{if(!p.equals("/api/internal/notifications/billing-events"))throw new IllegalStateException("Wrong financial endpoint");var input=json.readTree(exchange.getRequestBody());body=response.get()==null?"{\"eventId\":\""+input.path("id").asText()+"\",\"applied\":false}":response.get();}
  byte[] bytes=body.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);
 }catch(Exception ex){failure.set(ex.getClass().getSimpleName());exchange.sendResponseHeaders(500,-1);}finally{exchange.close();}});server.start();url="http://127.0.0.1:"+server.getAddress().getPort();}
 @AfterEach void stop(){server.stop(0);}
 @Test void resolvesActualOwnerAndAcceptsAnExactReplayAcknowledgementThroughHttp(){
  var client=new FinancialNotificationClient(secret,url,url);assertEquals(user,client.recipient(clinic,patient).userId());UUID event=UUID.randomUUID();client.send(json.createObjectNode().put("id",event.toString()));assertNull(failure.get());
 }
 @Test void invalidRecipientOrWrongAcknowledgementFailsClosedAndCallsInsideTransactionAreRejected(){
  var client=new FinancialNotificationClient(secret,url,url);response.set("{\"status\":\"OWNED\",\"userId\":null}");assertThrows(ApiProblem.class,()->client.recipient(clinic,patient));response.set("{\"status\":\"NO_ACCOUNT\",\"userId\":null}");assertEquals("NO_ACCOUNT",client.recipient(clinic,patient).status());response.set("{\"eventId\":\""+UUID.randomUUID()+"\",\"applied\":true}");assertThrows(ApiProblem.class,()->client.send(json.createObjectNode().put("id",UUID.randomUUID().toString())));
  org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(true);try{assertThrows(IllegalStateException.class,()->client.recipient(clinic,patient));assertThrows(IllegalStateException.class,()->client.send(json.createObjectNode()));}finally{org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(false);}assertNull(failure.get());
 }
}
