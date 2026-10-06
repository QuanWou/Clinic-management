package com.clinic.gateway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import java.net.URI;
import java.net.http.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"gateway.routes={\"patient\":\"http://127.0.0.1:18098/modules/patient\"}"})
class GatewayApplicationTest {
 @LocalServerPort int port;
 @Test void startsWithoutDatabaseOrJwtSecretAndRejectsUnknownRoutes()throws Exception{
  var client=HttpClient.newHttpClient();
  var health=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/actuator/health")).build(),HttpResponse.BodyHandlers.ofString());
  assertEquals(200,health.statusCode());assertTrue(health.body().contains("UP"));
  var unknown=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/s1/unknown/api/me")).build(),HttpResponse.BodyHandlers.ofString());
  assertEquals(404,unknown.statusCode());
 }
}
