package com.clinic.iam.repo;
import com.clinic.iam.domain.MembershipEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MembershipEventRepository extends JpaRepository<MembershipEvent,UUID>{
 List<MembershipEvent> findByClinicIdOrderByOccurredAtAsc(UUID clinicId);
}
