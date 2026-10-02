package com.clinic.v2.iam.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;
@Component
public class LegacyIdentityClient {
 private final RestClient client;
 public LegacyIdentityClient(@Value("${iam.security.legacy-identity-url}") String url){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(f).build();
 }
 public boolean current(String bearer,Actor actor){
  try{
   Envelope e=client.get().uri("/api/users/me").header(HttpHeaders.AUTHORIZATION,bearer).retrieve().body(Envelope.class);
   return e!=null&&e.success()&&e.data()!=null&&actor.id().equals(e.data().id())&&"ACTIVE".equals(e.data().status())&&actor.roles().equals(e.data().roles());
  }catch(Exception ex){return false;}
 }
 public record Envelope(boolean success,UserData data){}
 public record UserData(UUID id,String status,Set<String> roles){}
}
