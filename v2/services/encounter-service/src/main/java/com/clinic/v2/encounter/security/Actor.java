package com.clinic.v2.encounter.security;
import java.util.*;
import java.util.UUID;
public record Actor(UUID id,Set<String> legacyRoles,String bearer){
 public Actor(UUID id,Set<String> legacyRoles){this(id,legacyRoles,null);}
 @Override public String toString(){return "Actor[id="+id+", legacyRoles="+legacyRoles+"]";}
}

