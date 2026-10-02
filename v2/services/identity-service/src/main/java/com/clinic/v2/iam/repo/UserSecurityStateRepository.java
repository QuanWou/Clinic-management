package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.UserSecurityState;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface UserSecurityStateRepository extends JpaRepository<UserSecurityState,UUID>{}
