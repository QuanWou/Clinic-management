package com.clinic.v2.catalog.security;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;

@Component
public class IamAuthorizationClient {
    private final RestClient client;
    private final WorkloadTokenIssuer tokens;
    public IamAuthorizationClient(@Value("${catalog.security.iam-url}") String url,WorkloadTokenIssuer tokens){
        var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
        client=RestClient.builder().baseUrl(url).requestFactory(f).build();this.tokens=tokens;
    }
    public Decision decide(UUID userId,String capability,UUID clinicId,UUID branchId){
        try{
            Decision d=client.post().uri("/api/v2/internal/iam/authorization/check")
                .header(HttpHeaders.AUTHORIZATION,"Bearer "+tokens.toIam("iam.authorize"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(new Request(userId,clinicId,branchId,capability)).retrieve().body(Decision.class);
            return d==null?new Decision(false,null,null,0,"DEPENDENCY_EMPTY"):d;
        }catch(Exception ex){return new Decision(false,null,null,0,"DEPENDENCY_UNAVAILABLE");}
    }
    public record Request(UUID actorUserId,UUID clinicId,UUID branchId,String capability){}
    public record Decision(boolean allowed,UUID membershipId,String role,long membershipVersion,String reason){}
}
