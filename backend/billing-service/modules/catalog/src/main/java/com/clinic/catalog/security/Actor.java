package com.clinic.catalog.security;
import java.util.*;
import java.util.UUID;
public record Actor(UUID id,Set<String> legacyRoles){}
