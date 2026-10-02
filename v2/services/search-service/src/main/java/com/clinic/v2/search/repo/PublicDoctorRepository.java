package com.clinic.v2.search.repo;
import com.clinic.v2.search.domain.PublicDoctor;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface PublicDoctorRepository extends JpaRepository<PublicDoctor,PublicDoctor.Key>{
  List<PublicDoctor> findByClinicIdAndPublicVisibleTrueOrderByDisplayNameAsc(UUID clinicId);
  List<PublicDoctor> findByClinicIdAndBranchIdAndPublicVisibleTrueOrderByDisplayNameAsc(UUID clinicId,UUID branchId);
  void deleteByClinicId(UUID clinicId);

  @Query("""
    select d from PublicDoctor d
    where d.publicVisible=true and exists(select c from PublicClinic c where c.clinicId=d.clinicId and c.published=true)
      and exists(select b from PublicBranch b where b.branchId=d.branchId and b.clinicId=d.clinicId and b.active=true) and (
      lower(d.displayName) like lower(concat('%',:q,'%'))
      or lower(coalesce(d.specialtyName,'')) like lower(concat('%',:q,'%'))
    )
    order by d.displayName asc
  """)
  List<PublicDoctor> search(@Param("q") String q, org.springframework.data.domain.Pageable page);
}
