package com.clinic.v2.appointment.source;
import com.clinic.v2.appointment.api.ApiProblem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.time.*;
import java.util.*;

@Component
public class CatalogSourceClient{
 private final RestClient client;
 public CatalogSourceClient(@Value("${appointment.security.catalog-url}") String url){
  var f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(Duration.ofSeconds(2));f.setReadTimeout(Duration.ofSeconds(2));
  client=RestClient.builder().baseUrl(url).requestFactory(f).build();
 }
 public Offering requireOffering(UUID clinicId,UUID branchId,UUID offeringId){
  try{
   List<Offering> rows=client.get().uri("/api/v2/public/clinics/{clinicId}/branches/{branchId}/offerings",clinicId,branchId)
    .retrieve().body(new ParameterizedTypeReference<List<Offering>>(){});
   return Optional.ofNullable(rows).orElse(List.of()).stream().filter(x->offeringId.equals(x.offeringId())).findFirst().orElseThrow(ApiProblem::missing);
  }catch(ApiProblem e){throw e;}catch(Exception e){throw ApiProblem.unavailable("Catalog offering could not be verified");}
 }
 public record Offering(UUID offeringId,UUID clinicId,UUID branchId,String code,String name,String description,String specialtyCode,
   Integer durationMinutes,long amountVnd,String currency,UUID priceVersionId,Instant effectiveFrom,String taxPolicyCode,String discountPolicyCode,
   long offeringVersion,long branchOfferingVersion){}
}
