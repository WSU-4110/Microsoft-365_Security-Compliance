-- PostgreSQL schema for Northwatch (Microsoft 365 Security & Compliance Dashboard).
-- The backend runs this on start; every statement is safe to run more than once.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per completed scan of one client tenant. The full result is kept as JSON;
-- the columns beside it make portfolio and trend queries fast.
CREATE TABLE IF NOT EXISTS scans (
  id          SERIAL PRIMARY KEY,
  client_id   VARCHAR(100) NOT NULL,
  run_by      INTEGER REFERENCES users(id),
  ran_at      TIMESTAMPTZ NOT NULL,
  data_source VARCHAR(50) NOT NULL,
  score       NUMERIC,
  max_score   NUMERIC,
  compliance  NUMERIC,
  open_gaps   INTEGER NOT NULL DEFAULT 0,
  high_gaps   INTEGER NOT NULL DEFAULT 0,
  result      JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS scans_client_ran_idx ON scans (client_id, ran_at DESC);

-- Every action sent to a client tenant (account, device, alert, and playbook steps)
CREATE TABLE IF NOT EXISTS actions (
  id           SERIAL PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id    VARCHAR(100) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  action       VARCHAR(50) NOT NULL,
  target_type  VARCHAR(20) NOT NULL,
  target_id    VARCHAR(200) NOT NULL,
  target_name  VARCHAR(255),
  reason       TEXT NOT NULL,
  result       VARCHAR(20) NOT NULL,
  error        TEXT,
  playbook     VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS actions_client_at_idx ON actions (client_id, at DESC);
