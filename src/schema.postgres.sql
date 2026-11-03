CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','owner','viewer')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  csrf TEXT NOT NULL, expires_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
  category TEXT NOT NULL, mime TEXT NOT NULL, content BYTEA NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880), version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS grants (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id), permission TEXT NOT NULL CHECK (permission IN ('read','edit')),
  PRIMARY KEY (document_id,user_id)
);
CREATE TABLE IF NOT EXISTS audit (
  seq INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL, previous_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE OR REPLACE FUNCTION refuse_audit_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END;
$$;
DROP TRIGGER IF EXISTS audit_no_changes ON audit;
CREATE TRIGGER audit_no_changes BEFORE UPDATE OR DELETE OR TRUNCATE ON audit
FOR EACH STATEMENT EXECUTE FUNCTION refuse_audit_changes();
CREATE INDEX IF NOT EXISTS grants_user ON grants(user_id);
CREATE INDEX IF NOT EXISTS documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
