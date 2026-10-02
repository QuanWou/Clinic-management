package com.clinic.v2.iam.repo;

import com.clinic.v2.iam.domain.UserSessionState;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface UserSessionStateRepository extends JpaRepository<UserSessionState,UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSessionState s where s.userId=:id")
    Optional<UserSessionState> lockByUserId(@Param("id") UUID id);
}
