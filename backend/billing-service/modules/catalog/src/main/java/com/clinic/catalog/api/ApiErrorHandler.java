package com.clinic.catalog.api;
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
            .body(Map.of("error",Map.of("code","VERSION_OR_EFFECTIVE_TIME_CONFLICT",
                "message","Catalog version conflicts with an existing effective price or resource version")));
    }
}
