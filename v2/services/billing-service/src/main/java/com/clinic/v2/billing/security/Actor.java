package com.clinic.v2.billing.security;
import java.util.*;
import java.util.UUID;
public record Actor(UUID id,Set<String> legacyRoles,String bearer){
 @Override public String toString(){return "Actor[id="+id+", legacyRoles="+legacyRoles+"]";}
}

