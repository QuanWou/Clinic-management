package com.clinic.appointment.repo;
import com.clinic.appointment.domain.AppointmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface AppointmentHistoryRepository extends JpaRepository<AppointmentHistory,UUID>{
 List<AppointmentHistory> findByAppointmentIdOrderByOccurredAtAsc(UUID appointmentId);
}
