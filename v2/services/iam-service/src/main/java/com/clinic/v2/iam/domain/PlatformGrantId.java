package com.clinic.v2.iam.domain;
import java.io.Serializable;
import java.util.UUID;
public record PlatformGrantId(UUID userId, PlatformCapability capability) implements Serializable {}
