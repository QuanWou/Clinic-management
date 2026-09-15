package com.clinic.doctor.repository;

import com.clinic.doctor.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {
    List<Schedule> findByDoctorIdOrderByDayOfWeekAscStartTimeAsc(UUID doctorId);

    void deleteByDoctorId(UUID doctorId);
}
