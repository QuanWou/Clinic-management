package com.clinic.audit.security;

import java.util.Set;
import java.util.UUID;

public record Actor(UUID id, Set<String> roles) {}
