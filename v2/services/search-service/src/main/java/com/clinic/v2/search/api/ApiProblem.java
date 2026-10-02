package com.clinic.v2.search.api;
import org.springframework.http.HttpStatus;
public class ApiProblem extends RuntimeException {
  public final HttpStatus status; public final String code;
  public ApiProblem(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
  public static ApiProblem forbidden(){return new ApiProblem(HttpStatus.FORBIDDEN,"FORBIDDEN","Required workload scope is missing");}
  public static ApiProblem missing(){return new ApiProblem(HttpStatus.NOT_FOUND,"NOT_FOUND","Public projection was not found");}
  public static ApiProblem invalid(String message){return new ApiProblem(HttpStatus.BAD_REQUEST,"INVALID_INPUT",message);}
  public static ApiProblem unavailable(String message){return new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE,"SOURCE_UNAVAILABLE",message);}
}
