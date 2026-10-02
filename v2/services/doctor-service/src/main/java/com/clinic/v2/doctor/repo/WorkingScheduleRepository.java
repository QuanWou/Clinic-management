package com.clinic.v2.doctor.repo;
import com.clinic.v2.doctor.domain.WorkingSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface WorkingScheduleRepository extends JpaRepository<WorkingSchedule,UUID>{
    Optional<WorkingSchedule> findByIdAndClinicIdAndBranchId(UUID id,UUID clinicId,UUID branchId);
    List<WorkingSchedule> findByAffiliationIdAndClinicIdAndBranchIdOrderByDayOfWeekAscStartMinuteAsc(UUID affiliationId,UUID clinicId,UUID branchId);
}
