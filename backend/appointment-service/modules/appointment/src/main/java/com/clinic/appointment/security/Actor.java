package com.clinic.appointment.security;
import java.util.*;
public record Actor(UUID id,Set<String> roles){}
