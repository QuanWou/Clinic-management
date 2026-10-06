package com.clinic.appointment.repo;
import com.clinic.appointment.domain.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface OutboxEventRepository extends JpaRepository<OutboxEvent,UUID>{}
