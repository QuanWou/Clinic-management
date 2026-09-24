package com.clinic.notification.exception;

import com.clinic.common.dto.ErrorResponse;
import com.clinic.common.exception.BusinessException;
import com.clinic.common.constants.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException e) {
        log.error("Business exception: {}", e.getMessage());
        return ResponseEntity
                .status(mapErrorCodeToStatus(e.getErrorCode()))
                .body(new ErrorResponse(false, e.getErrorCode(), e.getMessage(), Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.error("Validation error: {}", message);
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(false, ErrorCode.VALIDATION_ERROR, message, Instant.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse(false, ErrorCode.INTERNAL_SERVER_ERROR, "An unexpected error occurred", Instant.now()));
    }

    private int mapErrorCodeToStatus(String errorCode) {
        return switch (errorCode) {
            case ErrorCode.RESOURCE_NOT_FOUND -> 404;
            case ErrorCode.UNAUTHORIZED -> 401;
            case ErrorCode.FORBIDDEN -> 403;
            case ErrorCode.CONFLICT -> 409;
            case ErrorCode.VALIDATION_ERROR -> 400;
            default -> 500;
        };
    }
}
