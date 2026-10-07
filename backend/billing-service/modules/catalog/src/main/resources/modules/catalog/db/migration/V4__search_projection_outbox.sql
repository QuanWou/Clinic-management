-- Non-PHI invalidation events are captured in the same business transaction.
CREATE TABLE catalog_v2.projection_outbox (
 sequence_id bigserial PRIMARY KEY, event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PUBLISHED','DEAD_LETTER')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error varchar(80), created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE INDEX projection_outbox_due ON catalog_v2.projection_outbox(status,next_attempt_at,sequence_id);
CREATE FUNCTION catalog_v2.capture_projection_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,catalog_v2 AS $$
DECLARE scope_id uuid;
BEGIN
 scope_id := (COALESCE(to_jsonb(NEW),to_jsonb(OLD))->>TG_ARGV[0])::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog_v2-projection:'||scope_id,0));
 INSERT INTO catalog_v2.projection_outbox(clinic_id) VALUES(scope_id);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER offerings_projection_change AFTER INSERT OR UPDATE OR DELETE ON catalog_v2.offerings FOR EACH ROW EXECUTE FUNCTION catalog_v2.capture_projection_change('clinic_id');
CREATE TRIGGER branch_offerings_projection_change AFTER INSERT OR UPDATE OR DELETE ON catalog_v2.branch_offerings FOR EACH ROW EXECUTE FUNCTION catalog_v2.capture_projection_change('clinic_id');
CREATE TRIGGER price_versions_projection_change AFTER INSERT OR UPDATE OR DELETE ON catalog_v2.price_versions FOR EACH ROW EXECUTE FUNCTION catalog_v2.capture_projection_change('clinic_id');
-- Narrow definer functions expose public fields only; runtime does not gain table-owner privileges.
CREATE FUNCTION catalog_v2.public_projection(scope_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,catalog_v2 AS $$
 SELECT jsonb_build_object('offerings',COALESCE(jsonb_agg(jsonb_build_object('offeringId',o.id,'clinicId',o.clinic_id,'branchId',b.branch_id,'code',o.code,'name',o.name,'specialtyCode',o.specialty_code,'amountVnd',p.amount_vnd,'currency',p.currency,'priceVersionId',p.id,'effectiveFrom',p.effective_from,'publicVisible',true)),'[]'::jsonb))
 FROM catalog_v2.offerings o JOIN catalog_v2.branch_offerings b ON b.offering_id=o.id AND b.clinic_id=o.clinic_id
 JOIN LATERAL (SELECT * FROM catalog_v2.price_versions p WHERE p.branch_offering_id=b.id AND p.effective_from<=now() ORDER BY effective_from DESC LIMIT 1) p ON true
 WHERE o.clinic_id=scope_id AND o.active AND b.active AND b.public_visible AND b.duration_minutes IS NOT NULL
$$;
CREATE FUNCTION catalog_v2.refresh_projection_time_boundaries() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,catalog_v2 AS $$
DECLARE scope_id uuid;
BEGIN
 FOR scope_id IN SELECT DISTINCT clinic_id FROM catalog_v2.offerings LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_v2-projection:'||scope_id,0));
  INSERT INTO catalog_v2.projection_outbox(clinic_id) SELECT scope_id
   WHERE NOT EXISTS(SELECT 1 FROM catalog_v2.projection_outbox WHERE clinic_id=scope_id AND status='PENDING');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION catalog_v2.capture_projection_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION catalog_v2.public_projection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION catalog_v2.refresh_projection_time_boundaries() FROM PUBLIC;
GRANT SELECT,UPDATE ON catalog_v2.projection_outbox TO clinic_v2_catalog_runtime;
GRANT EXECUTE ON FUNCTION catalog_v2.public_projection(uuid),catalog_v2.refresh_projection_time_boundaries() TO clinic_v2_catalog_runtime;

