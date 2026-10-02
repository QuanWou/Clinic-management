package com.clinic.v2.search.repo;
import com.clinic.v2.search.domain.PublicOffering;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface PublicOfferingRepository extends JpaRepository<PublicOffering,PublicOffering.Key>{
  List<PublicOffering> findByClinicIdAndPublicVisibleTrueOrderByNameAsc(UUID clinicId);
  List<PublicOffering> findByClinicIdAndBranchIdAndPublicVisibleTrueOrderByNameAsc(UUID clinicId,UUID branchId);
  void deleteByClinicId(UUID clinicId);

  @Query("""
    select o from PublicOffering o
    where o.publicVisible=true and exists(select c from PublicClinic c where c.clinicId=o.clinicId and c.published=true)
      and exists(select b from PublicBranch b where b.branchId=o.branchId and b.clinicId=o.clinicId and b.active=true) and (
      lower(o.name) like lower(concat('%',:q,'%'))
      or lower(o.code) like lower(concat('%',:q,'%'))
      or lower(coalesce(o.specialtyCode,'')) like lower(concat('%',:q,'%'))
    )
    order by o.name asc
  """)
  List<PublicOffering> search(@Param("q") String q, org.springframework.data.domain.Pageable page);
}
