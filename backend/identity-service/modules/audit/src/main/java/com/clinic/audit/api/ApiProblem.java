package com.clinic.audit.api;

import org.springframework.http.HttpStatus;

public class ApiProblem extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public ApiProblem(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
    public static ApiProblem invalid(String message){return new ApiProblem(HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_AUDIT_EVENT",message);}
    public static ApiProblem forbidden(){return new ApiProblem(HttpStatus.FORBIDDEN,"FORBIDDEN","Required workload scope is missing");}
}
