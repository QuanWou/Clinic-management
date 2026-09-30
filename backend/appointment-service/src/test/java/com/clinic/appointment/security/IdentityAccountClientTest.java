package com.clinic.appointment.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

class IdentityAccountClientTest {
    private final UUID userId = UUID.randomUUID();
    private final Set<String> roles = Set.of("ROLE_DOCTOR");

    private String response(String id, String status, String role) {
        return """
                {"success":true,"data":{"id":"%s","status":"%s","roles":["%s"],"email":"ignore@example.test"}}
                """.formatted(id, status, role);
    }

    @Test
    void activeAccountWithSameSubjectAndRolesIsAccepted() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://identity-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        IdentityAccountClient client = new IdentityAccountClient(builder.build());
        server.expect(requestTo("http://identity-service/api/users/me"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer access"))
                .andRespond(withSuccess(response(userId.toString(), "ACTIVE", "ROLE_DOCTOR"), MediaType.APPLICATION_JSON));

        assertTrue(client.isCurrentAccount("Bearer access", userId, roles));
        server.verify();
    }

    @Test
    void lockedAccountIsDeniedWithSamePreviouslyIssuedToken() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://identity-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        IdentityAccountClient client = new IdentityAccountClient(builder.build());
        server.expect(requestTo("http://identity-service/api/users/me"))
                .andRespond(withSuccess(response(userId.toString(), "LOCKED", "ROLE_DOCTOR"), MediaType.APPLICATION_JSON));

        assertFalse(client.isCurrentAccount("Bearer access", userId, roles));
        server.verify();
    }

    @Test
    void roleRevocationIsDeniedEvenBeforeJwtExpires() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://identity-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        IdentityAccountClient client = new IdentityAccountClient(builder.build());
        server.expect(requestTo("http://identity-service/api/users/me"))
                .andRespond(withSuccess(response(userId.toString(), "ACTIVE", "ROLE_PATIENT"), MediaType.APPLICATION_JSON));

        assertFalse(client.isCurrentAccount("Bearer access", userId, roles));
        server.verify();
    }

    @Test
    void unexpectedUserOrIdentityHttp401IsDenied() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://identity-service");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        IdentityAccountClient client = new IdentityAccountClient(builder.build());
        server.expect(requestTo("http://identity-service/api/users/me"))
                .andRespond(withSuccess(response(UUID.randomUUID().toString(), "ACTIVE", "ROLE_DOCTOR"), MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://identity-service/api/users/me"))
                .andRespond(withUnauthorizedRequest());

        assertFalse(client.isCurrentAccount("Bearer access", userId, roles));
        assertFalse(client.isCurrentAccount("Bearer access", userId, roles));
        server.verify();
    }
}
