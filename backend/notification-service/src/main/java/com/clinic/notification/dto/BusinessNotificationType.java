package com.clinic.notification.dto;

/** Stable v1 cross-service event names. No clinical details belong in the message. */
public enum BusinessNotificationType {
    APPOINTMENT_CREATED("Appointment received", "Your appointment request has been received."),
    APPOINTMENT_CONFIRMED("Appointment confirmed", "Your appointment has been confirmed."),
    APPOINTMENT_RESCHEDULED("Appointment changed", "Your appointment schedule has changed. Please check your appointments."),
    APPOINTMENT_CANCELLED("Appointment cancelled", "An appointment has been cancelled. Please check your appointments."),
    APPOINTMENT_REMINDER("Appointment reminder", "You have an upcoming appointment. Please check your appointments."),
    LAB_RESULT_READY("Lab result ready", "A laboratory result is available. Please sign in to review it securely."),
    INVOICE_PAID("Payment recorded", "A payment has been recorded. Please sign in to review your invoice.");

    private final String subject;
    private final String content;

    BusinessNotificationType(String subject, String content) {
        this.subject = subject;
        this.content = content;
    }

    public String subject() { return subject; }
    public String content() { return content; }
}
