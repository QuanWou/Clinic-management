package com.clinic.iam.security;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
public record Actor(UUID id, Set<String> roles, Instant issuedAt){
 public boolean hasRole(String role){return roles!=null&&roles.contains(role);}
}
