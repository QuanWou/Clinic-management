package com.clinic.v2.appointment.api;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestControllerAdvice
public class ApiErrorHandler{
 @ExceptionHandler(ApiProblem.class) ResponseEntity<?> p(ApiProblem e){return ResponseEntity.status(e.status).body(Map.of("error",Map.of("code",e.code,"message",e.getMessage())));}
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> v(MethodArgumentNotValidException e){return ResponseEntity.badRequest().body(Map.of("error",Map.of("code","VALIDATION_ERROR","message","Request fields are invalid")));}
}
