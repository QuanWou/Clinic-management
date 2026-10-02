package com.clinic.v2.appointment.security;
import java.util.*;
public record Actor(UUID id,Set<String> roles){}
