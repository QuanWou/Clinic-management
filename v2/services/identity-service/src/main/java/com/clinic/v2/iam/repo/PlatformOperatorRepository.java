package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.PlatformOperator;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface PlatformOperatorRepository extends JpaRepository<PlatformOperator,UUID>{}
