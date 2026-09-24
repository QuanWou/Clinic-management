package com.clinic.medicalrecord.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Read-only display metadata for records already authorized by MedicalRecordServiceImpl.
 * This deployment uses one PostgreSQL database with separate service-owned schemas;
 * all lookups remain restricted to the authenticated doctor's own record IDs.
 */
@Repository
public class MedicalRecordDisplayLookup {
    private final NamedParameterJdbcTemplate jdbc;

    public MedicalRecordDisplayLookup(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Display(String patientCode, String patientName, String doctorCode, String doctorName,
                          LocalDate appointmentDate, LocalTime startTime, LocalTime endTime) {}

    public Map<UUID, Display> forDoctor(UUID doctorId, List<UUID> recordIds) {
        if (recordIds.isEmpty()) return Map.of();
        String sql = """
            SELECT m.id AS record_id, p.patient_code, p.full_name AS patient_name,
                   d.doctor_code, u.full_name AS doctor_name,
                   a.appointment_date, a.start_time, a.end_time
            FROM medical_record.medical_records m
            LEFT JOIN patient.patients p ON p.id = m.patient_id
            LEFT JOIN doctor.doctors d ON d.id = m.doctor_id
            LEFT JOIN identity.users u ON u.id = d.user_id
            LEFT JOIN appointment.appointments a ON a.id = m.appointment_id
                 AND a.doctor_id = m.doctor_id AND a.patient_id = m.patient_id
            WHERE m.doctor_id = :doctorId AND m.id IN (:recordIds)
            """;
        var params = new MapSqlParameterSource().addValue("doctorId", doctorId).addValue("recordIds", recordIds);
        return jdbc.query(sql, params, (rs, index) -> Map.entry(
                rs.getObject("record_id", UUID.class),
                new Display(rs.getString("patient_code"), rs.getString("patient_name"),
                        rs.getString("doctor_code"), rs.getString("doctor_name"),
                        rs.getObject("appointment_date", LocalDate.class),
                        rs.getObject("start_time", LocalTime.class), rs.getObject("end_time", LocalTime.class))))
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /** Lookup is scoped by the treating doctor before a patient ID can be resolved. */
    public UUID patientIdForDoctorCode(UUID doctorId, String patientCode) {
        String sql = """
            SELECT DISTINCT m.patient_id FROM medical_record.medical_records m
            JOIN patient.patients p ON p.id = m.patient_id
            WHERE m.doctor_id = :doctorId AND p.patient_code = :patientCode
            LIMIT 1
            """;
        var ids = jdbc.query(sql, new MapSqlParameterSource().addValue("doctorId", doctorId)
                .addValue("patientCode", patientCode),
                (rs, index) -> rs.getObject("patient_id", UUID.class));
        return ids.isEmpty() ? null : ids.getFirst();
    }
}
