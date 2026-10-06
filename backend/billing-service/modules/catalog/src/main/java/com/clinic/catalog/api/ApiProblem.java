package com.clinic.catalog.api;
import org.springframework.http.HttpStatus;

public class ApiProblem extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public ApiProblem(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
    public static ApiProblem missing(){return new ApiProblem(HttpStatus.NOT_FOUND,"NOT_FOUND","Catalog resource not found");}
    public static ApiProblem invalid(String m){return new ApiProblem(HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_CATALOG_STATE",m);}
    public static ApiProblem conflict(String m){return new ApiProblem(HttpStatus.CONFLICT,"STATE_CONFLICT",m);}
    public static ApiProblem dependency(String m){return new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE,"DEPENDENCY_UNAVAILABLE",m);}
}
