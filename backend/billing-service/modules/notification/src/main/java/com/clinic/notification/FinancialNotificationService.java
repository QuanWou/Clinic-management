package com.clinic.notification;
import com.clinic.notification.api.ApiProblem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
@Service public class FinancialNotificationService{
 private final JdbcTemplate jdbc;private final ObjectMapper json;
 public FinancialNotificationService(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
 public record Ack(UUID eventId,boolean applied){}
 private void keys(JsonNode value,Set<String> expected){if(!value.isObject())throw ApiProblem.invalid("Object required");Set<String> actual=new HashSet<>();value.fieldNames().forEachRemaining(actual::add);if(!actual.equals(expected))throw ApiProblem.invalid("Unsupported financial notification fields");}
 private UUID id(JsonNode value,String field){if(!value.path(field).isTextual())throw ApiProblem.invalid("Identifier required");return UUID.fromString(value.path(field).asText());}
 @Transactional public Ack ingest(JsonNode event){
  keys(event,Set.of("specversion","id","source","type","subject","time","datacontenttype","clinicid","branchid","correlationid","aggregateversion","data"));
  var data=event.path("data");keys(data,Set.of("billingId","resourceId","recipientUserId"));
  if(!"1.0".equals(event.path("specversion").asText())||!"/services/billing".equals(event.path("source").asText())||!"application/json".equals(event.path("datacontenttype").asText())||!event.path("aggregateversion").isIntegralNumber()||!event.path("aggregateversion").canConvertToLong()||event.path("aggregateversion").asLong()<1)throw ApiProblem.invalid("Financial source envelope required");
  String type=event.path("type").asText();if(!Set.of("clinic.billing.bill_issued.v1","clinic.billing.onsite_collected.v1","clinic.billing.online_collected.v1","clinic.billing.adjustment_approved.v1").contains(type))throw ApiProblem.invalid("Unsupported financial notification type");
  try{
   UUID eventId=id(event,"id"),clinic=id(event,"clinicid"),bill=id(data,"billingId"),user=id(data,"recipientUserId");id(event,"branchid");id(event,"correlationid");id(data,"resourceId");Instant.parse(event.path("time").asText());
   if(!("billing/"+bill).equals(event.path("subject").asText()))throw ApiProblem.invalid("Financial subject mismatch");
   jdbc.execute("select set_config('app.notification_mode','consumer',true)");
   jdbc.execute("select pg_advisory_xact_lock(hashtextextended('financial-notification:"+eventId+"',0))");
   var previous=jdbc.queryForList("select payload_json::text as payload from notification_v2.financial_event_inbox where event_id=?",eventId);
   if(!previous.isEmpty()){JsonNode stored;try{stored=json.readTree(previous.getFirst().get("payload").toString());}catch(Exception ex){throw new IllegalStateException(ex);}if(!stored.equals(event))throw ApiProblem.invalid("Financial event ID payload changed");return new Ack(eventId,false);}
   jdbc.update("insert into notification_v2.financial_event_inbox(event_id,clinic_id,billing_id,user_id,source_version,payload_json) values(?,?,?,?,?,?::jsonb)",eventId,clinic,bill,user,event.path("aggregateversion").asLong(),event.toString());
   boolean online=type.equals("clinic.billing.online_collected.v1");boolean payment=online||type.equals("clinic.billing.onsite_collected.v1");
   String message=online?"Thanh toán online của bạn đã được xác nhận. Xem biên nhận trong lịch sử của bạn.":payment?"Phòng khám đã ghi nhận một khoản thu tại quầy. Xem biên nhận nội bộ trong lịch sử của bạn.":"Phiếu thu nội bộ của bạn đã được cập nhật. Xem khoản phải thu trong lịch sử của bạn.";
   jdbc.update("insert into notification_v2.notifications(id,user_id,clinic_id,billing_id,kind,message) values(?,?,?,?,?,?)",eventId,user,clinic,bill,payment?"PAYMENT_RECORDED":"BILL_UPDATED",message);
   return new Ack(eventId,true);
  }catch(IllegalArgumentException|java.time.DateTimeException ex){throw ApiProblem.invalid("Invalid financial notification identifiers or time");}
 }
}
