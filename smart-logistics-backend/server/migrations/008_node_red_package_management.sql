-- Optional private gateway package management. No runtime is enrolled by migration.
CREATE TABLE node_red_install_requests (
  id uuid PRIMARY KEY,
  runtime_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  gateway_id varchar(80) NOT NULL,
  target_revision char(64) NOT NULL CHECK (target_revision ~ '^[a-f0-9]{64}$'),
  actor_id integer NOT NULL REFERENCES users(id),
  module varchar(214) NOT NULL,
  version varchar(96) NOT NULL,
  state varchar(16) NOT NULL CHECK (state IN ('installing','installed','failed','unconfirmed')),
  message varchar(400) NOT NULL,
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (id, runtime_id, workspace_id, gateway_id)
);
CREATE INDEX node_red_install_workspace ON node_red_install_requests(workspace_id, started_at DESC);
-- Runtime identity is global: rebinding it cannot hide an unresolved old operation.
CREATE TABLE node_red_runtime_installs (
  runtime_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  gateway_id varchar(80) NOT NULL,
  current_request_id uuid NOT NULL,
  FOREIGN KEY (current_request_id, runtime_id, workspace_id, gateway_id)
    REFERENCES node_red_install_requests(id, runtime_id, workspace_id, gateway_id)
);
CREATE FUNCTION protect_node_red_install() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.runtime_id, NEW.workspace_id, NEW.gateway_id, NEW.target_revision,
      NEW.actor_id, NEW.module, NEW.version, NEW.started_at) IS DISTINCT FROM
     (OLD.id, OLD.runtime_id, OLD.workspace_id, OLD.gateway_id, OLD.target_revision,
      OLD.actor_id, OLD.module, OLD.version, OLD.started_at) THEN
    RAISE EXCEPTION 'Node-RED installation identity is immutable';
  END IF;
  IF (OLD.state IN ('installed','failed') AND NEW IS DISTINCT FROM OLD) OR
     (OLD.state='unconfirmed' AND NEW.state NOT IN ('installed','unconfirmed')) THEN
    RAISE EXCEPTION 'Node-RED installation outcome cannot be reset';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER node_red_install_identity BEFORE UPDATE ON node_red_install_requests
  FOR EACH ROW EXECUTE FUNCTION protect_node_red_install();
