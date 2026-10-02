package com.clinic.v2.patient.security;
import java.util.Set;
public record WorkloadPrincipal(String issuer,Set<String> scopes){public boolean hasScope(String s){return scopes!=null&&scopes.contains(s);}}
