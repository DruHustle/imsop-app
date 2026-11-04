-- Additive: legacy attempted rows have no reproducible wire request. They must
-- be reconciled, never silently re-rendered using new credentials or senders.
CREATE TABLE mail_requests (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK(provider IN ('resend','gmail','smtp')),
  encrypted_request text NOT NULL,
  request_sha256 text NOT NULL,
  configuration_hash text NOT NULL,
  recipient_hash text NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','sending','pending','sent','unknown','blocked','expired','failed')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  expires_at timestamptz NOT NULL,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION preserve_mail_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF ROW(NEW.id,NEW.provider,NEW.encrypted_request,NEW.request_sha256,NEW.configuration_hash,NEW.recipient_hash,NEW.expires_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.provider,OLD.encrypted_request,OLD.request_sha256,OLD.configuration_hash,OLD.recipient_hash,OLD.expires_at)
    OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at) THEN
    RAISE EXCEPTION 'Frozen mail request cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_mail_request BEFORE UPDATE ON mail_requests FOR EACH ROW EXECUTE FUNCTION preserve_mail_request();
UPDATE reset_deliveries SET state='unknown',lease_until=NULL WHERE state IN ('pending','sending') AND attempts>0;
UPDATE notification_deliveries SET state='unknown',lease_until=NULL WHERE state IN ('pending','sending') AND attempts>0;
