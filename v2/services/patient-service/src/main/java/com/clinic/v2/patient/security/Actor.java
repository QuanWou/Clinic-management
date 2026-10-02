package com.clinic.v2.patient.security;
import java.util.*;
public record Actor(UUID id,Set<String> roles){}
