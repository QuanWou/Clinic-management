package com.clinic.v2.search.repo;

import com.clinic.v2.search.domain.PublicClinic;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface PublicClinicRepository extends JpaRepository<PublicClinic,UUID> {
  Optional<PublicClinic> findBySlugAndPublishedTrue(String slug);

  @Query("""
    select c from PublicClinic c
    where c.published=true and (
      :q is null or lower(c.name) like lower(concat('%',:q,'%'))
      or lower(coalesce(c.description,'')) like lower(concat('%',:q,'%'))
      or lower(coalesce(c.locationText,'')) like lower(concat('%',:q,'%'))
    )
    order by c.name asc
  """)
  List<PublicClinic> search(@Param("q") String q, org.springframework.data.domain.Pageable page);
}
