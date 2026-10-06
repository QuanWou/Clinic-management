CREATE TABLE search_v2.projection_inbox (
 source varchar(80) NOT NULL,event_id uuid NOT NULL,clinic_id uuid NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,event_id)
);
CREATE TABLE search_v2.projection_snapshot_versions (
 source varchar(80) NOT NULL,clinic_id uuid NOT NULL,source_version bigint NOT NULL CHECK(source_version>0),
 PRIMARY KEY(source,clinic_id)
);
ALTER TABLE search_v2.public_offerings ALTER COLUMN name TYPE varchar(220);
GRANT SELECT,INSERT,UPDATE ON search_v2.projection_inbox,search_v2.projection_snapshot_versions TO clinic_v2_search_runtime;

