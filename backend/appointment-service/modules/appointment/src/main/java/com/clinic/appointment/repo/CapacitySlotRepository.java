package com.clinic.appointment.repo;
import com.clinic.appointment.domain.CapacitySlot;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface CapacitySlotRepository extends JpaRepository<CapacitySlot,UUID>{
 @Query(value="""
   select (select count(*) from appointment_v2.slot_reservations r join appointment_v2.capacity_slots s on s.id=r.slot_id
     where s.doctor_id=:doctor and s.starts_at<:until and s.ends_at>:from
     and r.state='ACTIVE' and r.expires_at>:now and (cast(:ignoreHold as uuid) is null or r.id<>cast(:ignoreHold as uuid)))
    +(select count(*) from appointment_v2.appointments a join appointment_v2.capacity_slots s on s.id=a.slot_id
     where s.doctor_id=:doctor and s.starts_at<:until and s.ends_at>:from
     and a.status in ('CONFIRMED','CHECKED_IN','FULFILLED') and (cast(:ignoreAppointment as uuid) is null or a.id<>cast(:ignoreAppointment as uuid)))
   """,nativeQuery=true)
 long countOverlapping(@Param("doctor") UUID doctor,@Param("from") Instant from,@Param("until") Instant until,
   @Param("now") Instant now,@Param("ignoreHold") String ignoreHold,@Param("ignoreAppointment") String ignoreAppointment);
 Optional<CapacitySlot> findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAt(UUID clinicId,UUID branchId,UUID offeringId,UUID doctorId,Instant startsAt);
 @Query("select s from CapacitySlot s where s.clinicId=:clinicId and s.branchId=:branchId and s.offeringId=:offeringId and s.doctorId=:doctorId and s.startsAt>=:from and s.startsAt<:to order by s.startsAt")
 List<CapacitySlot> findByClinicIdAndBranchIdAndOfferingIdAndDoctorIdAndStartsAtBetweenOrderByStartsAtAsc(UUID clinicId,UUID branchId,UUID offeringId,UUID doctorId,Instant from,Instant to);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select s from CapacitySlot s where s.id=:id")
 Optional<CapacitySlot> lockById(@Param("id") UUID id);
}
