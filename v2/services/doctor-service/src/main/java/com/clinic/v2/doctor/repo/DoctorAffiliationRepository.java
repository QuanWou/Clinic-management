package com.clinic.v2.doctor.repo;
import com.clinic.v2.doctor.domain.DoctorAffiliation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DoctorAffiliationRepository extends JpaRepository<DoctorAffiliation,UUID>{
    Optional<DoctorAffiliation> findByIdAndClinicIdAndBranchId(UUID id,UUID clinicId,UUID branchId);
    List<DoctorAffiliation> findByClinicIdAndBranchIdOrderByCreatedAtAsc(UUID clinicId,UUID branchId);
    List<DoctorAffiliation> findByPractitionerIdAndClinicIdAndBranchIdOrderByEffectiveFromDesc(UUID practitionerId,UUID clinicId,UUID branchId);
}
