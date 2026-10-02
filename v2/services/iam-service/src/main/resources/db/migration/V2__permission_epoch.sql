CREATE TABLE iam.user_permission_epochs (
  user_id uuid PRIMARY KEY,
  epoch bigint NOT NULL DEFAULT 1 CHECK (epoch > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
