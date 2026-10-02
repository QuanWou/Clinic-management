package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.SecurityEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface SecurityEventRepository extends JpaRepository<SecurityEvent,UUID> {}
