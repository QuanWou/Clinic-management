package com.clinic.appointment.dto;

import java.time.LocalDate;
import java.util.List;

/** Aggregated, role-scoped activity only: never exposes patient or appointment identifiers. */
public record ReceptionHistoryResponse(LocalDate from, LocalDate to, String scope, List<Day> days) {
    public record Day(LocalDate date, long appointments, long checkIns, long completedVisits,
                      long cancelledAppointments) {}
}