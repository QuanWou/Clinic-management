package com.clinic.v2.appointment.repo;
import com.clinic.v2.appointment.domain.SlotReservation;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface SlotReservationRepository extends JpaRepository<SlotReservation,UUID>{
 Optional<SlotReservation> findByPatientIdAndIdempotencyKey(UUID patientId,String idempotencyKey);
 List<SlotReservation> findByPatientIdAndStateAndExpiresAtAfterOrderByCreatedAtDesc(UUID patientId,String state,Instant now);
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @Query("select r from SlotReservation r where r.id=:id")
 Optional<SlotReservation> lockById(@Param("id") UUID id);
 @Query("select count(r) from SlotReservation r where r.slotId=:slotId and r.state='ACTIVE' and r.expiresAt>:now")
 long countActive(@Param("slotId") UUID slotId,@Param("now") Instant now);
 @Modifying
 @Query("update SlotReservation r set r.state='EXPIRED' where r.state='ACTIVE' and r.expiresAt<=:now")
 int expireDue(@Param("now") Instant now);
}
