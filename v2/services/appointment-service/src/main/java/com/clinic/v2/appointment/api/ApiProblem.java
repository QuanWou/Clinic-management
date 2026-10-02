package com.clinic.v2.appointment.api;
import org.springframework.http.HttpStatus;
public class ApiProblem extends RuntimeException{
 public final HttpStatus status;public final String code;
 public ApiProblem(HttpStatus status,String code,String message){super(message);this.status=status;this.code=code;}
 public static ApiProblem missing(){return new ApiProblem(HttpStatus.NOT_FOUND,"NOT_FOUND","Appointment resource was not found");}
 public static ApiProblem unavailable(String m){return new ApiProblem(HttpStatus.CONFLICT,"SLOT_UNAVAILABLE",m);}
 public static ApiProblem conflict(String m){return new ApiProblem(HttpStatus.CONFLICT,"IDEMPOTENCY_CONFLICT",m);}
 public static ApiProblem invalid(String m){return new ApiProblem(HttpStatus.UNPROCESSABLE_ENTITY,"INVALID_WORKFLOW",m);}
 public static ApiProblem forbidden(){return new ApiProblem(HttpStatus.FORBIDDEN,"FORBIDDEN","Appointment access denied");}
 public static ApiProblem dependency(String m){return new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE,"DEPENDENCY_UNAVAILABLE",m);}
}
