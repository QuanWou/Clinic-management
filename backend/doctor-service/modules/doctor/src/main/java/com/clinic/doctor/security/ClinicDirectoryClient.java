package com.clinic.doctor.security;
import com.clinic.doctor.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.util.*;

@Component
public class ClinicDirectoryClient {
    public void requirePublishedBranch(UUID clinicId,UUID branchId){
        try{
            PublicClinic c=client.get().uri("/api/public/clinics/by-id/{id}",clinicId).retrieve().body(PublicClinic.class);
            if(c==null||!clinicId.equals(c.id())||c.branches()==null||c.branches().stream().noneMatch(b->branchId.equals(b.id())&&b.active()))throw ApiProblem.missing();
        }catch(ApiProblem ex){throw ex;}catch(org.springframework.web.client.HttpClientErrorException.NotFound ex){throw ApiProblem.missing();}
        catch(Exception ex){throw ApiProblem.dependency("Clinic publication could not be verified");}
    }
    public record PublicBranch(UUID id,boolean active){}
    public record PublicClinic(UUID id,List<PublicBranch> branches){}
    private final RestClient client;
    private final WorkloadTokenIssuer tokens;
    public ClinicDirectoryClient(@Value("${doctor.security.clinic-url}") String url,WorkloadTokenIssuer tokens){
        var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
        client=RestClient.builder().baseUrl(url).requestFactory(f).build();this.tokens=tokens;
    }
    public void requireBranch(UUID clinicId,UUID branchId){
        try{
            Scope s=client.get().uri(uri->uri.path("/api/internal/clinics/{clinicId}/scope")
                    .queryParam("branchIds",branchId).build(clinicId))
                .header(HttpHeaders.AUTHORIZATION,"Bearer "+tokens.toClinic("clinic.scope.read"))
                .retrieve().body(Scope.class);
            if(s==null||!s.exists()||s.validBranchIds()==null||!s.validBranchIds().contains(branchId))
                throw ApiProblem.invalid("Clinic/branch scope is not valid");
        }catch(ApiProblem ex){throw ex;}
        catch(Exception ex){throw ApiProblem.dependency("Clinic scope verification unavailable");}
    }
    public record Scope(UUID clinicId,UUID ownerUserId,boolean exists,Set<UUID> validBranchIds){}
}
