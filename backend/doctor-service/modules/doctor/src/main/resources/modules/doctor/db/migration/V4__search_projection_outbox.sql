-- Non-PHI invalidation events are captured in the same business transaction.
CREATE TABLE doctor.projection_outbox (
 sequence_id bigserial PRIMARY KEY, event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PUBLISHED','DEAD_LETTER')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error varchar(80), created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE INDEX projection_outbox_due ON doctor.projection_outbox(status,next_attempt_at,sequence_id);
CREATE FUNCTION doctor.capture_projection_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,doctor AS $$
DECLARE scope_id uuid;
BEGIN
 scope_id := (COALESCE(to_jsonb(NEW),to_jsonb(OLD))->>TG_ARGV[0])::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('doctor-projection:'||scope_id,0));
 INSERT INTO doctor.projection_outbox(clinic_id) VALUES(scope_id);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER doctor_affiliations_projection_change AFTER INSERT OR UPDATE OR DELETE ON doctor.doctor_affiliations FOR EACH ROW EXECUTE FUNCTION doctor.capture_projection_change('clinic_id');
CREATE TRIGGER working_schedules_projection_change AFTER INSERT OR UPDATE OR DELETE ON doctor.working_schedules FOR EACH ROW EXECUTE FUNCTION doctor.capture_projection_change('clinic_id');
-- Narrow definer functions expose public fields only; runtime does not gain table-owner privileges.
CREATE FUNCTION doctor.public_projection(scope_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,doctor AS $$
 SELECT jsonb_build_object('doctors',COALESCE(jsonb_agg(item),'[]'::jsonb)) FROM (
 SELECT DISTINCT ON(a.practitioner_id,a.branch_id) jsonb_build_object('doctorId',p.id,'clinicId',a.clinic_id,'branchId',a.branch_id,'displayName',p.display_name,'specialtyCode',a.specialty_code,'specialtyName',a.specialty_name,'professionalTitle',a.professional_title,'publicVisible',true) item
 FROM doctor.doctor_affiliations a JOIN doctor.practitioners p ON p.id=a.practitioner_id
 WHERE a.clinic_id=scope_id AND a.active AND a.public_visible AND a.effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date AND (a.effective_until IS NULL OR a.effective_until>(now() at time zone 'Asia/Ho_Chi_Minh')::date)
 ORDER BY a.practitioner_id,a.branch_id,a.effective_from DESC) records
$$;
CREATE FUNCTION doctor.refresh_projection_time_boundaries() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,doctor AS $$
DECLARE scope_id uuid;
BEGIN
 FOR scope_id IN SELECT DISTINCT clinic_id FROM doctor.doctor_affiliations LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('doctor-projection:'||scope_id,0));
  INSERT INTO doctor.projection_outbox(clinic_id) SELECT scope_id
   WHERE NOT EXISTS(SELECT 1 FROM doctor.projection_outbox WHERE clinic_id=scope_id AND status='PENDING');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION doctor.capture_projection_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION doctor.public_projection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION doctor.refresh_projection_time_boundaries() FROM PUBLIC;
GRANT SELECT,UPDATE ON doctor.projection_outbox TO clinic_v2_doctor_runtime;
GRANT EXECUTE ON FUNCTION doctor.public_projection(uuid),doctor.refresh_projection_time_boundaries() TO clinic_v2_doctor_runtime;


