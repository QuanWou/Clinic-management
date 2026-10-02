package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.PermissionEpoch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface PermissionEpochRepository extends JpaRepository<PermissionEpoch,UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select e from PermissionEpoch e where e.userId=:id")
  Optional<PermissionEpoch> lockByUserId(@Param("id") UUID id);
}
