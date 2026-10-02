package com.clinic.v2.medical.api;
import com.clinic.v2.medical.security.Actor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.MethodParameter;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** Persist access metadata before serializing a clinical response. Never inspect its body. */
@RestControllerAdvice(basePackages="com.clinic.v2.medical.api")
public class ClinicalAccessAuditAdvice implements ResponseBodyAdvice<Object> {
 private static final Pattern SCOPE=Pattern.compile("^/api/v2/clinics/([0-9a-fA-F-]{36})/branches/([0-9a-fA-F-]{36})(/.*)$");
 private final JdbcTemplate jdbc;private final ObjectMapper json;private final TransactionTemplate tx;
 public ClinicalAccessAuditAdvice(JdbcTemplate jdbc,ObjectMapper json,PlatformTransactionManager manager){this.jdbc=jdbc;this.json=json;tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);}
 public boolean supports(MethodParameter returnType,Class<? extends HttpMessageConverter<?>> converterType){return true;}
 public Object beforeBodyWrite(Object body,MethodParameter returnType,MediaType contentType,Class<? extends HttpMessageConverter<?>> converterType,ServerHttpRequest request,ServerHttpResponse response){
  if(!(response instanceof ServletServerHttpResponse servlet))return body;
  var auth=SecurityContextHolder.getContext().getAuthentication();if(auth==null||!auth.isAuthenticated()||!(auth.getPrincipal() instanceof Actor actor))return body;
  int status=servlet.getServletResponse().getStatus();boolean denied=status==403||status==404;if(!denied&&!(status>=200&&status<300&&HttpMethod.GET.equals(request.getMethod())))return body;
  var match=SCOPE.matcher(request.getURI().getPath());if(!match.matches())return body;
  UUID clinic,branch;try{clinic=UUID.fromString(match.group(1));branch=UUID.fromString(match.group(2));}catch(IllegalArgumentException ex){return body;}
  String suffix=match.group(3),operation;UUID resource=branch;
  if("medical".equals("medical")){
   if(suffix.equals("/lab/orders"))operation="READ_LAB_WORKLIST";
   else if(suffix.matches("/visits/[0-9a-fA-F-]{36}/(draft|orders|readiness|validate)")){resource=UUID.fromString(suffix.split("/")[2]);operation=denied&&!HttpMethod.GET.equals(request.getMethod())?"CARE_MUTATION":switch(suffix.substring(suffix.lastIndexOf('/')+1)){case "draft"->"READ_DRAFT";case "orders"->"READ_ORDERS";default->"READ_READINESS";};}
   else if(denied&&suffix.matches("/orders/[0-9a-fA-F-]{36}/(accept|process|reject|cancel|results|reviews)")){resource=UUID.fromString(suffix.split("/")[2]);operation="CARE_MUTATION";}
   else return body;
  }else{
   if(suffix.equals("/doctor/worklist"))operation="READ_WORKLIST";
   else if(suffix.matches("/doctor/visits/[0-9a-fA-F-]{36}(/(start|await-results|resume-queue|complete|close))?")){resource=UUID.fromString(suffix.split("/")[3]);operation=HttpMethod.GET.equals(request.getMethod())?"READ_ENCOUNTER":"CARE_MUTATION";}
   else if(suffix.matches("/visits/[0-9a-fA-F-]{36}(/start)?")){resource=UUID.fromString(suffix.split("/")[2]);operation=HttpMethod.GET.equals(request.getMethod())?"READ_ENCOUNTER":"CARE_MUTATION";}
   else return body;
  }
  UUID id=UUID.randomUUID(),target=resource;String outcome=denied?"DENIED":"SUCCESS";var event=new LinkedHashMap<String,Object>();
  event.put("specversion","1.0");event.put("id",id.toString());event.put("source","/services/medical");event.put("type","clinic.medical.access_recorded.v1");event.put("subject","clinical-access/"+target);event.put("time",Instant.now().toString());event.put("datacontenttype","application/json");event.put("clinicid",clinic.toString());event.put("branchid",branch.toString());event.put("correlationid",UUID.randomUUID().toString());event.put("aggregateversion",1);event.put("data",Map.of("resourceId",target.toString(),"actorUserId",actor.id().toString(),"operation",operation,"outcome",outcome));
  String payload;try{payload=json.writeValueAsString(event);}catch(com.fasterxml.jackson.core.JsonProcessingException ex){throw new IllegalStateException("Clinical access audit serialization failed");}
  tx.executeWithoutResult(t->{jdbc.queryForObject("select set_config('app.clinic_id',?,true)",String.class,clinic.toString());jdbc.queryForObject("select set_config('app.branch_id',?,true)",String.class,branch.toString());jdbc.update("insert into medical_v2.outbox_events(event_id,clinic_id,branch_id,aggregate_id,event_type,payload_json) values(?,?,?,?,?,?)",id,clinic,branch,target,"clinic.medical.access_recorded.v1",payload);});
  return body;
 }
}

