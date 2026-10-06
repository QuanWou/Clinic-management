package com.clinic.search;
import com.clinic.search.api.SearchDto.*;
import com.clinic.search.api.ApiProblem;
import com.clinic.search.service.SearchProjectionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@EnabledIfSystemProperty(named="search.it.enabled",matches="true")
class SearchPostgresTest{
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){S1Postgres.configure(r);}
 @Autowired SearchProjectionService service;
 @Autowired com.clinic.search.service.ProjectionSnapshotService snapshots;
 @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
 @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
 UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),second=UUID.randomUUID(),doctor=UUID.randomUUID();
 ClinicProjectionInput clinic(long version,boolean published,boolean active){
  return new ClinicProjectionInput(clinic,"synthetic-"+clinic,"Synthetic Clinic "+clinic,null,"Synthetic location",
    published,version,Instant.now(),UUID.randomUUID(),List.of(
     new BranchInput(branch,"Synthetic one","Synthetic address","08-17",active,version),
     new BranchInput(second,"Synthetic two","Synthetic address","08-17",true,version)));
 }
 DoctorProjectionInput doctor(UUID at,long version,String name){
  return new DoctorProjectionInput(doctor,clinic,at,name,"GEN","Synthetic specialty",null,true,version,UUID.randomUUID());
 }
 @Test void branchReceiptsDoNotSuppressSameDoctorAndSuspensionHidesEveryEndpoint(){
  service.projectClinic(clinic(1,true,true));
  assertTrue(service.projectDoctor(doctor(branch,5,"Synthetic Alpha")).applied());
  assertTrue(service.projectDoctor(doctor(second,1,"Synthetic Beta")).applied());
  assertEquals(2,service.doctors(clinic,null).size());
  assertFalse(service.projectDoctor(doctor(branch,4,"Old")).applied());
  assertEquals("Synthetic Alpha",service.doctors(clinic,branch).get(0).displayName());
  service.projectClinic(clinic(2,true,false));
  assertEquals(1,service.search("Synthetic",50).doctors().stream().filter(d->d.clinicId().equals(clinic)).count());
  assertThrows(ApiProblem.class,()->service.doctors(clinic,branch));
  service.projectClinic(clinic(3,false,false));
  assertTrue(service.search("Synthetic",50).doctors().stream().noneMatch(d->d.clinicId().equals(clinic)));
  assertThrows(ApiProblem.class,()->service.doctors(clinic,null));
  assertThrows(ApiProblem.class,()->service.offerings(clinic,null));
  assertFalse(service.projectClinic(clinic(2,true,true)).applied());
  service.projectClinic(clinic(4,true,true));
  assertEquals(2,service.doctors(clinic,null).size());
 }
 @Test void concurrentVersionsNeverOverwriteNewerProjection() throws Exception{
  service.projectClinic(clinic(1,true,true));
  var executor=Executors.newFixedThreadPool(2);
  try{
   var barrier=new CyclicBarrier(2);
   var low=executor.submit(()->{barrier.await();return service.projectDoctor(doctor(branch,2,"Low"));});
   var high=executor.submit(()->{barrier.await();return service.projectDoctor(doctor(branch,3,"High"));});
   low.get(20,TimeUnit.SECONDS);high.get(20,TimeUnit.SECONDS);
   assertEquals("High",service.doctors(clinic,branch).get(0).displayName());
  }finally{executor.shutdownNow();}
 }
 @Test void forgedBranchOwnershipIsRejected(){
  service.projectClinic(clinic(1,true,true));
  assertThrows(ApiProblem.class,()->service.projectDoctor(new DoctorProjectionInput(doctor,UUID.randomUUID(),branch,
    "Forbidden",null,null,null,true,1,UUID.randomUUID())));
 }
 @Test void snapshotInboxIsAtomicDeduplicatedAndRemovesMissingChildren(){
  service.projectClinic(clinic(1,true,true));
  var principal=new com.clinic.search.security.WorkloadPrincipal("doctor-service",Set.of("search.project"));
  var event=UUID.randomUUID();
  var payload=json.createObjectNode();payload.set("doctors",json.valueToTree(List.of(doctor(branch,1,"Fresh"))));
  var first=delivery("doctor",event,4,payload);
  assertTrue(snapshots.accept(principal,first).applied());
  assertFalse(snapshots.accept(principal,first).applied());
  assertEquals(1,jdbc.queryForObject("select count(*) from search_v2.projection_inbox where event_id=?",Integer.class,event));
  var empty=json.createObjectNode();empty.putArray("doctors");
  assertTrue(snapshots.accept(principal,delivery("doctor",UUID.randomUUID(),5,empty)).applied());
  assertTrue(service.doctors(clinic,branch).isEmpty());
  assertFalse(snapshots.accept(principal,delivery("doctor",UUID.randomUUID(),3,payload)).applied());
  assertTrue(service.doctors(clinic,branch).isEmpty());
 }
 @Test void invalidSnapshotRollsBackHideAndInboxAndParentCannotReassignBranch(){
  service.projectClinic(clinic(1,true,true));service.projectDoctor(doctor(branch,1,"Original"));
  var principal=new com.clinic.search.security.WorkloadPrincipal("doctor-service",Set.of("search.project"));
  var payload=json.createObjectNode();payload.set("doctors",json.valueToTree(List.of(new DoctorProjectionInput(doctor,UUID.randomUUID(),branch,"Bad",null,null,null,true,1,UUID.randomUUID()))));
  var event=UUID.randomUUID();
  assertThrows(ApiProblem.class,()->snapshots.accept(principal,delivery("doctor",event,8,payload)));
  assertEquals("Original",service.doctors(clinic,branch).getFirst().displayName());
  assertEquals(0,jdbc.queryForObject("select count(*) from search_v2.projection_inbox where event_id=?",Integer.class,event));
  assertThrows(ApiProblem.class,()->service.projectClinic(new ClinicProjectionInput(UUID.randomUUID(),"forged-"+clinic,"Forged",null,null,true,1,Instant.now(),UUID.randomUUID(),List.of(new BranchInput(branch,"bad","bad","bad",true,1)))));
 }
 private com.clinic.search.service.ProjectionSnapshotService.Delivery delivery(String source,UUID id,long version,com.fasterxml.jackson.databind.JsonNode payload){
  var event=json.createObjectNode().put("specversion","1.0").put("id",id.toString()).put("clinicid",clinic.toString()).put("source","/services/"+source).put("type","clinic."+source+".public_changed.v1").put("aggregateversion",version);
  return new com.clinic.search.service.ProjectionSnapshotService.Delivery(id,clinic,version,payload,event);
 }
}
