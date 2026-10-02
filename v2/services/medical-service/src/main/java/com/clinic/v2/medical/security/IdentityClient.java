package com.clinic.v2.medical.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;

@Component
public class IdentityClient {
    private final RestClient client;
    public IdentityClient(@Value("${medical.security.iam-url}") String url){
        var f=new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
        client=RestClient.builder().baseUrl(url).requestFactory(f).build();
    }
    public Actor current(String bearer){
        try{
            CurrentActor me=client.get().uri("/api/v2/me/current")
                .header(HttpHeaders.AUTHORIZATION,bearer).retrieve().body(CurrentActor.class);
            if(me==null||me.userId()==null||me.legacyRoles()==null||me.legacyRoles().isEmpty()) return null;
            return new Actor(me.userId(),Set.copyOf(me.legacyRoles()),null);
        }catch(Exception ex){return null;}
    }
    public record CurrentActor(UUID userId,Set<String> legacyRoles,boolean platformOperator){}
}

