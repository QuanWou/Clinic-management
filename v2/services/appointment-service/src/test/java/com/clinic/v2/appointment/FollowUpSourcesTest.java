package com.clinic.v2.appointment;
import com.clinic.v2.appointment.api.*;
import com.clinic.v2.appointment.api.AppointmentDto.FollowUpInput;
import com.clinic.v2.appointment.source.FollowUpSources;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class FollowUpSourcesTest {
 HttpServer encounter,medical;UUID c,b,e,p;FollowUpInput input;FollowUpSources sources;Map<String,Object> visit,plan;int status=200;
 @BeforeEach void setup()throws Exception{
  c=UUID.randomUUID();b=UUID.randomUUID();e=UUID.randomUUID();p=UUID.randomUUID();input=new FollowUpInput(c,b,UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),p,e,b);
  visit=new HashMap<>(Map.of("encounterId",e,"clinicId",c,"branchId",b,"patientId",p,"status","CLOSED","medicalCaseVersion",7));
  plan=new HashMap<>(Map.of("encounterId",e,"clinicId",c,"branchId",b,"patientId",p,"caseVersion",7,"proposedDate","2026-12-01"));
  encounter=server(visit);medical=server(plan);sources=new FollowUpSources("http://127.0.0.1:"+encounter.getAddress().getPort(),"http://127.0.0.1:"+medical.getAddress().getPort());
 }
 HttpServer server(Map<String,Object> body)throws Exception{var s=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);s.createContext("/",x->{assertEquals("Bearer synthetic-patient",x.getRequestHeaders().getFirst("Authorization"));assertEquals("/api/v2/me/clinics/"+c+"/branches/"+b+"/visits/"+e+"/follow-up-proof",x.getRequestURI().getPath());byte[] payload=new ObjectMapper().writeValueAsBytes(body);x.getResponseHeaders().set("Content-Type","application/json");x.sendResponseHeaders(status,payload.length);x.getResponseBody().write(payload);x.close();});s.start();return s;}
 @AfterEach void stop(){encounter.stop(0);medical.stop(0);}
 @Test void combinesMatchingPatientOwnedCompletedVisitAndImmutableDate(){var proof=sources.proof("Bearer synthetic-patient",input);assertEquals(e,proof.encounterId());assertEquals(7,proof.medicalVersion());assertEquals("2026-12-01",proof.proposedDate().toString());}
 @Test void rejectsMismatchedPatientBranchVersionAndUncompletedOrUnavailableSource(){
  plan.put("patientId",UUID.randomUUID());assertThrows(ApiProblem.class,()->sources.proof("Bearer synthetic-patient",input));plan.put("patientId",p);plan.put("branchId",UUID.randomUUID());assertThrows(ApiProblem.class,()->sources.proof("Bearer synthetic-patient",input));plan.put("branchId",b);plan.put("caseVersion",8);assertThrows(ApiProblem.class,()->sources.proof("Bearer synthetic-patient",input));plan.put("caseVersion",7);visit.put("status","IN_PROGRESS");assertThrows(ApiProblem.class,()->sources.proof("Bearer synthetic-patient",input));visit.put("status","CLOSED");status=503;assertEquals("DEPENDENCY_UNAVAILABLE",assertThrows(ApiProblem.class,()->sources.proof("Bearer synthetic-patient",input)).code);assertThrows(ApiProblem.class,()->sources.proof(null,input));
 }
}
