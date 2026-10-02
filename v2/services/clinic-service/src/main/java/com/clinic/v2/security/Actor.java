package com.clinic.v2.security;
import java.util.Set;
import java.util.UUID;
public record Actor(UUID id, Set<String> roles){
    public boolean hasRole(String role){return roles!=null && roles.contains(role);}
}
