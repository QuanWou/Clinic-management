package com.clinic.v2.billing.api;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiProblem.class) ResponseEntity<?> problem(ApiProblem ex){
        return ResponseEntity.status(ex.status).body(Map.of("error",Map.of("code",ex.code,"message",ex.getMessage())));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException ex){
        return ResponseEntity.badRequest().body(Map.of("error",Map.of("code","VALIDATION_ERROR","message","Request fields are invalid")));
    }
    @ExceptionHandler({DataIntegrityViolationException.class,ObjectOptimisticLockingFailureException.class})
    ResponseEntity<?> conflict(RuntimeException ex){
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error",Map.of("code","BILLING_CONFLICT","message","Billing state or source reference conflicts; reload before retry")));
    }
}

