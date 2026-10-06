package com.clinic.patient.security;
import java.util.*;
public record Actor(UUID id,Set<String> roles){}
