package com.clinic.notification.exception;

import com.clinic.common.dto.ErrorResponse;
import com.clinic.common.exception.BusinessException;
import com.clinic.common.constants.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
        log.debug("Business request rejected errorCode={}", e.getErrorCode());
        return ResponseEntity
                .status(mapErrorCodeToStatus(e.getErrorCode()))
                .body(new ErrorResponse(false, e.getErrorCode(), e.getMessage(), Instant.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(AccessDeniedException e) {
        return ResponseEntity.status(403)
                .body(new ErrorResponse(false, ErrorCode.FORBIDDEN, "Access denied", Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.debug("Request validation rejected");
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(false, ErrorCode.VALIDATION_ERROR, message, Instant.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        // HTTP/SMTP/JDBC exceptions may include personal information or credentials.
        log.error("Unexpected notification API failure type={}", e.getClass().getSimpleName());
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
