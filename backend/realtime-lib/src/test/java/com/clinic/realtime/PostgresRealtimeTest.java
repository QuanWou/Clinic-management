package com.clinic.realtime;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostgresRealtimeTest {
 @Test void channelsAreDomainTenantAndOwnerScoped(){
  UUID clinic=UUID.randomUUID(),branch=UUID.randomUUID(),owner=UUID.randomUUID();
  String channel=PostgresRealtime.channel("encounter_doctor",clinic,branch,owner);
  assertTrue(channel.matches("encounter_doctor_[a-f0-9]{32}"));
  assertEquals(channel,PostgresRealtime.channel("encounter_doctor",clinic,branch,owner));
  assertNotEquals(channel,PostgresRealtime.channel("encounter_doctor",UUID.randomUUID(),branch,owner));
  assertNotEquals(channel,PostgresRealtime.channel("encounter_doctor",clinic,branch,UUID.randomUUID()));
  assertNotEquals(channel,PostgresRealtime.channel("medical_doctor",clinic,branch,owner));
  assertThrows(IllegalArgumentException.class,()->PostgresRealtime.channel("unsafe;LISTEN",clinic));
 }
 @Test void deniedSubscriptionNeverOpensADatabaseListener() throws Exception {
  var data=mock(DataSource.class);
  try(var realtime=new PostgresRealtime(data)){
   assertThrows(SecurityException.class,()->realtime.subscribe(PostgresRealtime.channel("billing",UUID.randomUUID()),()->{throw new SecurityException();},mock(HttpServletResponse.class),error->true));
   verifyNoInteractions(data);
  }
 }
 @Test void concurrentBrowserSubscriptionsShareOneListenConnection() throws Exception {
  var data=mock(DataSource.class);var connection=mock(Connection.class);var statement=mock(Statement.class);var pg=mock(PGConnection.class);
  when(data.getConnection()).thenReturn(connection);when(connection.createStatement()).thenReturn(statement);when(connection.unwrap(PGConnection.class)).thenReturn(pg);
  when(pg.getNotifications(1000)).thenAnswer(call->{Thread.sleep(10);return null;});
  try(var realtime=new PostgresRealtime(data)){
   var clinic=UUID.randomUUID();var branch=UUID.randomUUID();var response=mock(HttpServletResponse.class);
   for(int i=0;i<12;i++)realtime.subscribe(PostgresRealtime.channel("encounter",clinic,branch),()->{},response,error->true);
   verify(statement,timeout(3000)).execute("LISTEN "+PostgresRealtime.channel("encounter",clinic,branch));
   verify(data,times(1)).getConnection();verify(response,atLeastOnce()).setHeader("Cache-Control","no-store");
  }
 }
}
