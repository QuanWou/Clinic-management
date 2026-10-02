-- Non-PHI invalidation events are captured in the same business transaction.
CREATE TABLE clinic.projection_outbox (
 sequence_id bigserial PRIMARY KEY, event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PUBLISHED','DEAD_LETTER')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error varchar(80), created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE INDEX projection_outbox_due ON clinic.projection_outbox(status,next_attempt_at,sequence_id);
CREATE FUNCTION clinic.capture_projection_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,clinic AS $$
DECLARE scope_id uuid;
BEGIN
 scope_id := (COALESCE(to_jsonb(NEW),to_jsonb(OLD))->>TG_ARGV[0])::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinic-projection:'||scope_id,0));
 INSERT INTO clinic.projection_outbox(clinic_id) VALUES(scope_id);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER clinics_projection_change AFTER INSERT OR UPDATE OR DELETE ON clinic.clinics FOR EACH ROW EXECUTE FUNCTION clinic.capture_projection_change('id');
CREATE TRIGGER branches_projection_change AFTER INSERT OR UPDATE OR DELETE ON clinic.branches FOR EACH ROW EXECUTE FUNCTION clinic.capture_projection_change('clinic_id');
CREATE TRIGGER clinic_licenses_projection_change AFTER INSERT OR UPDATE OR DELETE ON clinic.clinic_licenses FOR EACH ROW EXECUTE FUNCTION clinic.capture_projection_change('clinic_id');
-- Narrow definer functions expose public fields only; runtime does not gain table-owner privileges.
CREATE FUNCTION clinic.public_projection(scope_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,clinic AS $$
 SELECT jsonb_build_object('clinic',jsonb_build_object('clinicId',c.id,'slug',c.slug,'name',c.name,'description',c.public_description,'locationText',NULL,'published',
 c.review_status='APPROVED' AND c.evidence_verified AND c.publication_status='PUBLISHED' AND c.published_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM clinic.clinic_licenses l WHERE l.clinic_id=c.id AND l.valid_until>=(now() at time zone 'Asia/Ho_Chi_Minh')::date)
 AND EXISTS(SELECT 1 FROM clinic.branches b WHERE b.clinic_id=c.id AND b.active),
 'sourceUpdatedAt',c.updated_at,'branches',COALESCE((SELECT jsonb_agg(jsonb_build_object('branchId',b.id,'name',b.name,'address',b.address,'openingHours',b.opening_hours,'active',b.active,'sourceVersion',1)) FROM clinic.branches b WHERE b.clinic_id=c.id),'[]'::jsonb)))
 FROM clinic.clinics c WHERE c.id=scope_id
$$;
CREATE FUNCTION clinic.refresh_projection_time_boundaries() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,clinic AS $$
DECLARE scope_id uuid;
BEGIN
 FOR scope_id IN SELECT id AS clinic_id FROM clinic.clinics LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('clinic-projection:'||scope_id,0));
  INSERT INTO clinic.projection_outbox(clinic_id) SELECT scope_id
   WHERE NOT EXISTS(SELECT 1 FROM clinic.projection_outbox WHERE clinic_id=scope_id AND status='PENDING');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION clinic.capture_projection_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION clinic.public_projection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION clinic.refresh_projection_time_boundaries() FROM PUBLIC;
GRANT SELECT,UPDATE ON clinic.projection_outbox TO clinic_v2_clinic_runtime;
GRANT EXECUTE ON FUNCTION clinic.public_projection(uuid),clinic.refresh_projection_time_boundaries() TO clinic_v2_clinic_runtime;



