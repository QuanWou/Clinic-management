package com.clinic.gateway;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import static org.junit.jupiter.api.Assertions.*;
class GatewayServletTest {
 @Test void restrictsTargetsAndPreservesQuery()throws Exception{
  var gateway=new GatewayServlet("{\"patient\":\"http://127.0.0.1:8098/modules/patient\"}");
  assertEquals("http://127.0.0.1:8098/modules/patient/api/me?limit=20",gateway.destination("/s1/patient/api/me","limit=20").toString());
  for(String path:new String[]{"/s1/unknown/api/me","/s1/patient/actuator/env","/s1/patient/api/../auth","/s1/patient/api/%2e%2e/auth","/s1/patient/api/%2Fadmin"})assertNull(gateway.destination(path,null));
  assertThrows(IllegalArgumentException.class,()->new GatewayServlet("{\"x\":\"http://example.com:8098/modules/patient\"}"));
 }
 @Test void preservesDownstreamDenialAndDoesNotInventAuthentication()throws Exception{
  var backend=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  backend.createContext("/modules/patient/api/me",exchange->{assertEquals("Bearer test-only",exchange.getRequestHeaders().getFirst("Authorization"));byte[] body="{\"denied\":true}".getBytes();exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(403,body.length);exchange.getResponseBody().write(body);exchange.close();});backend.start();
  try{var gateway=new GatewayServlet("{\"patient\":\"http://127.0.0.1:"+backend.getAddress().getPort()+"/modules/patient\"}");var request=new MockHttpServletRequest("GET","/s1/patient/api/me");request.addHeader("Authorization","Bearer test-only");var response=new MockHttpServletResponse();gateway.service(request,response);assertEquals(403,response.getStatus());assertTrue(response.getContentAsString().contains("denied"));}finally{backend.stop(0);}
 }
}
