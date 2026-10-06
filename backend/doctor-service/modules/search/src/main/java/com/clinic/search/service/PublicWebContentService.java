package com.clinic.search.service;

import com.clinic.search.api.ApiProblem;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class PublicWebContentService {
  private final SearchProjectionService search;
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public PublicWebContentService(SearchProjectionService search,JdbcTemplate jdbc,ObjectMapper json){
    this.search=search;this.jdbc=jdbc;this.json=json;
  }

  @Transactional(readOnly=true)
  public JsonNode content(UUID clinicId){
    search.clinic(clinicId);
    var rows=jdbc.query("select content::text from search_v2.public_web_content where clinic_id=?",
      (rs,row)->rs.getString(1),clinicId);
    if(rows.isEmpty())throw ApiProblem.missing();
    try{return json.readTree(rows.getFirst());}
    catch(JsonProcessingException invalid){throw new IllegalStateException("Stored public web content is invalid",invalid);}
  }
}
