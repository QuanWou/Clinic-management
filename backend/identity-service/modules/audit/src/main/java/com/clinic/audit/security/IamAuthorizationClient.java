package com.clinic.audit.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.UUID;

@Component
public class IamAuthorizationClient {
    private final RestClient client;
    private final IamWorkloadTokenIssuer tokens;

    public IamAuthorizationClient(@Value("${audit.security.iam-url}") String url,IamWorkloadTokenIssuer tokens){
        var factory=new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
        this.tokens=tokens;
    }

    public boolean allowed(UUID userId,String capability,UUID clinicId){
        try{
            Decision decision=client.post().uri("/api/internal/iam/authorization/check")
                .header(HttpHeaders.AUTHORIZATION,"Bearer "+tokens.issue("iam.authorize"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(new AuthorizationRequest(userId,clinicId,null,capability))
                .retrieve().body(Decision.class);
            return decision!=null&&decision.allowed();
        }catch(Exception ex){
            return false;
        }
    }

    record AuthorizationRequest(UUID actorUserId,UUID clinicId,UUID branchId,String capability){}
    record Decision(boolean allowed,UUID membershipId,String role,long membershipVersion,String reason){}
}
