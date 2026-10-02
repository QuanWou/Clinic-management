package com.clinic.v2.iam.security;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record Actor(UUID id, Set<String> globalRoles, Instant tokenIssuedAt) {}
