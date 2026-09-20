package com.clinic.appointment.dto;

import com.clinic.appointment.entity.QueueStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateQueueStatusRequest(@NotNull QueueStatus status) {
}