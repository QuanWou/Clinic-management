package com.clinic.v2.audit.service;
@FunctionalInterface
public interface EventPublisher {
    void publish(String eventJson) throws Exception;
}
