package com.clinic.iam.repo;
import com.clinic.iam.domain.PlatformOperator;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface PlatformOperatorRepository extends JpaRepository<PlatformOperator,UUID>{}
