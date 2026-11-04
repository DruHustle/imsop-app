"""Standalone IMSOP edge ingress: Node-RED -> Python -> HTTPS -> farm API.

Only read-only observations are accepted. No hardware command is implemented.
"""
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import signal
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import UUID

ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$")
MAX_BYTES = 16384


def validate_event(value, allowed_sources):
    if not isinstance(value, dict) or set(value) != {
        "schemaVersion", "eventId", "sourceId", "observedAt", "kind", "data"
    } or type(value["schemaVersion"]) is not int or value["schemaVersion"] != 1:
        raise ValueError("invalid_envelope")
    if not isinstance(value["sourceId"], str) or not ID.fullmatch(value["sourceId"]) or value["sourceId"] not in allowed_sources:
        raise ValueError("source_not_commissioned")
    try:
        identity = UUID(value["eventId"])
        if str(identity) != value["eventId"].lower():
            raise ValueError()
    except (ValueError, AttributeError, TypeError):
        raise ValueError("invalid_event_identity")
    try:
        observed_at = datetime.fromisoformat(value["observedAt"].replace("Z", "+00:00"))
        if observed_at.tzinfo is None or observed_at.timestamp() > time.time() + 300:
            raise ValueError()
    except (ValueError, AttributeError, TypeError, OverflowError):
        raise ValueError("invalid_observation_time")
    data = value["data"]
    if not isinstance(data, dict):
        raise ValueError("invalid_data")
    if value["kind"] == "truck_gps":
        required = {"vehicleId", "latitude", "longitude"}
        optional = {"accuracyM", "speedKph", "trackingNumber"}
        if not required <= set(data) or set(data) - (required | optional):
            raise ValueError("invalid_gps")
        if data["vehicleId"] != value["sourceId"]:
            raise ValueError("source_vehicle_identity_mismatch")
        for key, lower, upper in (("latitude", -90, 90), ("longitude", -180, 180),
                                  ("accuracyM", 0, 100000), ("speedKph", 0, 300)):
            if key in data and (type(data[key]) not in (float, int)
                                or not math.isfinite(data[key])
                                or not lower <= data[key] <= upper):
                raise ValueError("invalid_gps")
        if "trackingNumber" in data and (not isinstance(data["trackingNumber"], str)
                                         or not 1 <= len(data["trackingNumber"].strip()) <= 100):
            raise ValueError("invalid_tracking")
    elif value["kind"] == "warehouse_sensor":
        if set(data) != {"warehouseId", "assetId", "metric", "value", "unit"}:
            raise ValueError("invalid_warehouse_sensor")
        for key in ("warehouseId", "assetId", "metric"):
            if not isinstance(data[key], str) or not ID.fullmatch(data[key]):
                raise ValueError("invalid_warehouse_sensor")
        if type(data["value"]) not in (float, int) or not math.isfinite(data["value"]):
            raise ValueError("invalid_warehouse_sensor")
        if not isinstance(data["unit"], str) or not 1 <= len(data["unit"]) <= 32:
            raise ValueError("invalid_warehouse_sensor")
    else:
        raise ValueError("unsupported_event_kind")
    return value

class EdgeState:
    def __init__(self, filename, max_pending=50000):
        if type(max_pending) is not int or not 1 <= max_pending <= 200000:
            raise ValueError("invalid_edge_queue_limit")
        self.max_pending = max_pending
        path = Path(filename)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        os.chmod(path, 0o600)
        self.lock = threading.Lock()
        with self.conn:
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA synchronous=FULL")
            self.conn.execute(
                "CREATE TABLE IF NOT EXISTS outbox "
                "(event_id TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL,"
                "attempts INTEGER NOT NULL DEFAULT 0,next_attempt REAL NOT NULL DEFAULT 0,"
                "quarantined INTEGER NOT NULL DEFAULT 0)"
            )
            self.conn.execute(
                "CREATE TABLE IF NOT EXISTS security_events "
                "(id INTEGER PRIMARY KEY,received_at REAL NOT NULL,reason TEXT NOT NULL)"
            )

    def security(self, reason):
        with self.lock, self.conn:
            self.conn.execute(
                "INSERT INTO security_events(received_at,reason) VALUES(?,?)",
                (time.time(), str(reason)[:80])
            )

    def accept(self, event):
        canonical = json.dumps(event, sort_keys=True, separators=(",", ":"), allow_nan=False)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        with self.lock, self.conn:
            old = self.conn.execute(
                "SELECT digest FROM outbox WHERE event_id=?", (event["eventId"],)
            ).fetchone()
            if old:
                if old[0] != digest:
                    raise ValueError("event_identity_conflict")
                return True
            if self.conn.execute("SELECT count(*) FROM outbox").fetchone()[0] >= self.max_pending:
                raise OverflowError("edge_outbox_full")
            self.conn.execute(
                "INSERT INTO outbox(event_id,payload,digest) VALUES(?,?,?)",
                (event["eventId"], canonical, digest)
            )
            return False

    def due(self):
        with self.lock:
            return self.conn.execute(
                "SELECT event_id,payload,attempts FROM outbox "
                "WHERE quarantined=0 AND next_attempt<=? ORDER BY rowid LIMIT 1",
                (time.time(),)
            ).fetchone()

    def delivered(self, event_id):
        with self.lock, self.conn:
            self.conn.execute("DELETE FROM outbox WHERE event_id=?", (event_id,))

    def retry(self, event_id, attempts, permanent=False):
        delay = min(300, 2 ** min(attempts, 8))
        with self.lock, self.conn:
            self.conn.execute(
                "UPDATE outbox SET attempts=?, next_attempt=?, quarantined=? WHERE event_id=?",
                (attempts, time.time() + delay, int(permanent), event_id)
            )


class EdgeAgent:
    def __init__(self, state, gateway_id, sources, ingress_token, outbound_secret,
                 api_origin, allow_loopback_http=False, opener=urlopen):
        if not ID.fullmatch(gateway_id) or len(ingress_token) < 32 or len(outbound_secret) < 32:
            raise ValueError("invalid_agent_identity_or_credentials")
        parsed = urlsplit(api_origin)
        allowed_http = (allow_loopback_http and parsed.scheme == "http"
                        and parsed.hostname in ("localhost", "127.0.0.1"))
        if (parsed.scheme != "https" and not allowed_http) or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("api_origin_requires_https")
        if not sources or any(not ID.fullmatch(source) for source in sources):
            raise ValueError("no_commissioned_sources")
        self.state, self.gateway_id = state, gateway_id
        self.sources, self.ingress_token, self.outbound_secret = set(sources), ingress_token, outbound_secret
        self.target = api_origin.rstrip("/") + "/api/edge/" + gateway_id + "/events"
        self.opener = opener

    def ingest(self, payload, presented_token):
        if not hmac.compare_digest(presented_token, self.ingress_token):
            self.state.security("local_auth_rejected")
            return 401, {"error": "unauthorized"}
        if not 0 < len(payload) <= MAX_BYTES:
            self.state.security("oversized_or_empty")
            return 413, {"error": "invalid_size"}
        try:
            event = validate_event(json.loads(payload.decode("utf-8")), self.sources)
            duplicate = self.state.accept(event)
        except OverflowError:
            return 503, {"error": "delivery_queue_full"}
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError, TypeError) as error:
            self.state.security(str(error))
            return 400, {"error": "invalid_observation"}
        return 202, {"queued": True, "duplicate": duplicate, "eventId": event["eventId"]}

    def deliver_once(self):
        row = self.state.due()
        if not row:
            return False
        event_id, payload, attempts = row
        timestamp = str(int(time.time()))
        body = payload.encode("utf-8")
        signature = hmac.new(self.outbound_secret.encode("utf-8"),
                             timestamp.encode("ascii") + b"." + body,
                             hashlib.sha256).hexdigest()
        request = Request(self.target, body, method="POST", headers={
            "Content-Type": "application/json",
            "X-Edge-Timestamp": timestamp,
            "X-Edge-Signature": "sha256=" + signature
        })
        try:
            with self.opener(request, timeout=8) as response:
                if response.status not in (200, 202):
                    raise RuntimeError("unexpected_response")
            self.state.delivered(event_id)
            return True
        except HTTPError as error:
            self.state.retry(event_id, attempts + 1, permanent=error.code in (400,401,403,409,422))
        except (URLError, TimeoutError, OSError, RuntimeError):
            self.state.retry(event_id, attempts + 1)
        return False


def serve(agent, port):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/ingest" or self.headers.get("content-type") != "application/json":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = -1
            if length < 1 or length > MAX_BYTES:
                self.send_error(413)
                return
            status, reply = agent.ingest(
                self.rfile.read(length),
                self.headers.get("Authorization", "").removeprefix("Bearer ")
            )
            body = json.dumps(reply).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    stop = threading.Event()
    def shutdown(_signal, _frame):
        stop.set()
        threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        while not stop.is_set():
            agent.deliver_once()
            stop.wait(0.5)
    finally:
        server.server_close()


if __name__ == "__main__":
    state = EdgeState(os.environ["EDGE_STATE_PATH"])
    agent = EdgeAgent(
        state, os.environ["EDGE_GATEWAY_ID"],
        set(filter(None, os.environ["EDGE_SOURCE_IDS"].split(","))),
        os.environ["EDGE_INGRESS_TOKEN"],
        os.environ["EDGE_OUTBOUND_SECRET"],
        os.environ["EDGE_API_URL"],
        os.environ.get("EDGE_ALLOW_LOOPBACK_HTTP") == "true"
    )
    serve(agent, int(os.environ.get("EDGE_AGENT_PORT", "18777")))
