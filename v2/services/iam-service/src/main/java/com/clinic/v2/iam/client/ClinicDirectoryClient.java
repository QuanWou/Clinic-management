package com.clinic.v2.iam.client;

import com.clinic.v2.iam.api.ApiProblem;
import com.clinic.v2.iam.security.ClinicWorkloadTokenIssuer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;

@Component
public class ClinicDirectoryClient {
    private final RestClient client;
    private final ClinicWorkloadTokenIssuer tokens;
    public ClinicDirectoryClient(@Value("${iam.security.clinic-url}") String url,ClinicWorkloadTokenIssuer tokens){
        var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
        this.client=RestClient.builder().baseUrl(url).requestFactory(f).build();this.tokens=tokens;
    }
    public Scope clinicScope(UUID clinicId,Collection<UUID> branchIds){
        try{
            String joined=branchIds==null||branchIds.isEmpty()?"":branchIds.stream().map(UUID::toString).sorted().reduce((a,b)->a+","+b).orElse("");
            return client.get().uri(uri->{
                var b=uri.path("/api/v2/internal/clinics/{id}/scope");
                if(!joined.isBlank()) b.queryParam("branchIds",joined);
                return b.build(clinicId);
            }).header(HttpHeaders.AUTHORIZATION,"Bearer "+tokens.issue()).retrieve().body(Scope.class);
        }catch(Exception ex){throw ApiProblem.dependency("Clinic scope could not be verified");}
    }
    public record Scope(UUID clinicId,UUID ownerUserId,boolean exists,Set<UUID> validBranchIds){}
}
