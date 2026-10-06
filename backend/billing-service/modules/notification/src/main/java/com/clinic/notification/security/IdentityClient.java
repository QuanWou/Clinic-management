package com.clinic.notification.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;
@Component
public class IdentityClient{
 private final RestClient client;
 public IdentityClient(@Value("${notification.security.identity-url}") String url){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(f).build();
 }
 public Actor current(String bearer){
  try{
   Current c=client.get().uri("/api/me/current").header(HttpHeaders.AUTHORIZATION,bearer).retrieve().body(Current.class);
   return c==null?null:new Actor(c.userId(),c.legacyRoles()==null?Set.of():Set.copyOf(c.legacyRoles()));
  }catch(Exception e){return null;}
 }
 record Current(UUID userId,Set<String> legacyRoles,boolean platformOperator){}
}

