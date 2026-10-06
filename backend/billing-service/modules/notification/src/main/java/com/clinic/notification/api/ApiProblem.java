package com.clinic.notification.api;
import org.springframework.http.HttpStatus;
public class ApiProblem extends RuntimeException{
 public final HttpStatus status;public final String code;
 public ApiProblem(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
 public static ApiProblem missing(){return new ApiProblem(HttpStatus.NOT_FOUND,"NOT_FOUND","Patient profile was not found");}
 public static ApiProblem conflict(String m){return new ApiProblem(HttpStatus.CONFLICT,"VERSION_CONFLICT",m);}
 public static ApiProblem forbidden(){return new ApiProblem(HttpStatus.FORBIDDEN,"FORBIDDEN","Patient access denied");}
 public static ApiProblem invalid(String m){return new ApiProblem(HttpStatus.BAD_REQUEST,"INVALID_INPUT",m);}
}

