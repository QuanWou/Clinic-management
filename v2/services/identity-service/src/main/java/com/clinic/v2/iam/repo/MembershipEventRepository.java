package com.clinic.v2.iam.repo;
import com.clinic.v2.iam.domain.MembershipEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MembershipEventRepository extends JpaRepository<MembershipEvent,UUID>{
 List<MembershipEvent> findByClinicIdOrderByOccurredAtAsc(UUID clinicId);
}
