CREATE TABLE audit_v2.producer_inbox(source varchar(80) NOT NULL,event_id uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,event_id));
GRANT SELECT,INSERT ON audit_v2.producer_inbox TO clinic_v2_audit_runtime;
