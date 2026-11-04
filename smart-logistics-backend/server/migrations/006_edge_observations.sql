-- Standalone, read-only Smart Logistics gateway telemetry. No route/status projection is inferred.
-- Scope every event to a provisioned workspace; old ambiguous rows remain untouched.
CREATE TABLE edge_observations (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  gateway_id varchar(80) NOT NULL,
  event_id uuid NOT NULL,
  source_id varchar(80) NOT NULL,
  kind varchar(32) NOT NULL CHECK (kind IN ('truck_gps','warehouse_sensor')),
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  payload_hash char(64) NOT NULL,
  PRIMARY KEY (workspace_id,gateway_id,event_id)
);
CREATE INDEX edge_observations_workspace_recent ON edge_observations(workspace_id,received_at DESC);
