package com.clinic.clinic.api;

import org.springframework.http.HttpStatus;

public class ApiProblem extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public ApiProblem(HttpStatus status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public static ApiProblem forbidden() { return new ApiProblem(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not authorized for this action"); }
    public static ApiProblem missing() { return new ApiProblem(HttpStatus.NOT_FOUND, "NOT_FOUND", "Clinic or branch not found"); }
    public static ApiProblem conflict(String message) { return new ApiProblem(HttpStatus.CONFLICT, "STATE_CONFLICT", message); }
    public static ApiProblem invalid(String message) { return new ApiProblem(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_WORKFLOW", message); }
    public static ApiProblem dependency(String message) { return new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE, "DEPENDENCY_UNAVAILABLE", message); }
}
