package com.clinic.audit.service;
@FunctionalInterface
public interface EventPublisher {
    void publish(String eventJson) throws Exception;
}
