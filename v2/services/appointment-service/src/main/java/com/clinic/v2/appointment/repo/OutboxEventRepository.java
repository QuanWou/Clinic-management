package com.clinic.v2.appointment.repo;
import com.clinic.v2.appointment.domain.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface OutboxEventRepository extends JpaRepository<OutboxEvent,UUID>{}
