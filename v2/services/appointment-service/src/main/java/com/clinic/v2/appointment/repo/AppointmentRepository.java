package com.clinic.v2.appointment.repo;
import com.clinic.v2.appointment.domain.Appointment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface AppointmentRepository extends JpaRepository<Appointment,UUID>{
 Optional<Appointment> findByReservationId(UUID reservationId);
 Optional<Appointment> findByPatientIdAndConfirmationKey(UUID patientId,String confirmationKey);
 List<Appointment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
 @Query("select count(a) from Appointment a where a.slotId=:slotId and a.status in ('CONFIRMED','CHECKED_IN','FULFILLED')")
 long countOccupying(@Param("slotId") UUID slotId);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select a from Appointment a where a.id=:id")
 Optional<Appointment> lockById(@Param("id") UUID id);
}
