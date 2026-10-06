package com.clinic.iam.security;

import java.util.Set;

public record WorkloadPrincipal(String issuer, Set<String> scopes) {
    public boolean hasScope(String scope) {
        return scopes != null && scopes.contains(scope);
    }
}
