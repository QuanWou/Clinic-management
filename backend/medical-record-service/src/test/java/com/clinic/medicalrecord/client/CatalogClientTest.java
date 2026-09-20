package com.clinic.medicalrecord.client;

import com.clinic.common.constants.ErrorCode;
import com.clinic.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CatalogClientTest {
    @Test
    void acceptsOnlyMatchingActiveLabService() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        CatalogClient client = new CatalogClient(builder, "http://catalog-service");
        UUID id = UUID.randomUUID();
        server.expect(requestTo("http://catalog-service/api/catalog/services/" + id))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer token"))
                .andRespond(withSuccess("""
                        {"success":true,"data":{"id":"%s","code":"CBC","name":"Blood count","active":true}}
                        """.formatted(id), MediaType.APPLICATION_JSON));

        assertEquals("Blood count", client.requireActiveService("Bearer token", id, "cbc").name());
        server.verify();
    }

    @Test
    void rejectsInactiveCatalogService() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        CatalogClient client = new CatalogClient(builder, "http://catalog-service");
        UUID id = UUID.randomUUID();
        server.expect(requestTo("http://catalog-service/api/catalog/services/" + id))
                .andRespond(withSuccess("""
                        {"success":true,"data":{"id":"%s","code":"CBC","name":"Blood count","active":false}}
                        """.formatted(id), MediaType.APPLICATION_JSON));

        BusinessException error = assertThrows(BusinessException.class,
                () -> client.requireActiveService("Bearer token", id, "CBC"));
        assertEquals(ErrorCode.CONFLICT, error.getErrorCode());
        server.verify();
    }
}
