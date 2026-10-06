CREATE TABLE search_v2.public_web_content (
  clinic_id uuid PRIMARY KEY REFERENCES search_v2.public_clinics(clinic_id) ON DELETE CASCADE,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  source_label varchar(240) NOT NULL,
  source_sha256 char(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON search_v2.public_web_content TO clinic_v2_search_runtime;
