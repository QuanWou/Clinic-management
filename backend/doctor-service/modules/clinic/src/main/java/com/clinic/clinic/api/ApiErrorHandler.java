package com.clinic.clinic.api;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import java.util.*;

@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiProblem.class) ResponseEntity<?> problem(ApiProblem ex){
        return ResponseEntity.status(ex.status).body(Map.of("error",Map.of("code",ex.code,"message",ex.getMessage())));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException ex){
        return ResponseEntity.badRequest().body(Map.of("error",Map.of("code","VALIDATION_ERROR","message","Request fields are invalid")));
    }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> duplicate(DataIntegrityViolationException ex){
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error",Map.of("code","CONSTRAINT_CONFLICT","message","A conflicting clinic or branch already exists")));
    }
}
