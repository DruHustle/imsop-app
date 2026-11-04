import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from agent import EdgeAgent, EdgeState, validate_event


class FakeResponse:
    status = 202
    def __enter__(self): return self
    def __exit__(self, *_): pass


def sample():
    return {
        "schemaVersion": 1, "eventId": str(uuid4()), "sourceId": "truck-42",
        "observedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "kind": "truck_gps",
        "data": {"vehicleId": "truck-42", "latitude": -17.8252, "longitude": 31.0335,
                 "accuracyM": 15, "speedKph": 34.2}
    }


class EdgeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "edge.sqlite3"
        self.state = EdgeState(self.path)
        self.outbound = []
        def opener(request, timeout):
            self.outbound.append(request)
            return FakeResponse()
        self.agent = EdgeAgent(
            self.state, "truck-gateway-1", {"truck-42", "warehouse-temp-1"},
            "a" * 40, "b" * 40, "https://api.example.test", opener=opener
        )

    def tearDown(self):
        self.state.conn.close()
        self.directory.cleanup()

    def test_source_scope_and_rejection_ledger(self):
        record = sample()
        body = json.dumps(record).encode()
        self.assertEqual(self.agent.ingest(body, "wrong")[0], 401)
        self.assertEqual(self.agent.ingest(body, "a" * 40)[0], 202)
        self.assertTrue(self.agent.ingest(body, "a" * 40)[1]["duplicate"])
        record["sourceId"] = "unknown-truck"
        self.assertEqual(self.agent.ingest(json.dumps(record).encode(), "a" * 40)[0], 400)
        self.assertGreater(self.state.conn.execute("SELECT count(*) FROM security_events").fetchone()[0], 0)

    def test_sqlite_restart_and_signed_https_delivery(self):
        record = sample()
        self.agent.ingest(json.dumps(record).encode(), "a" * 40)
        self.state.conn.close()
        self.state = EdgeState(self.path)
        self.agent.state = self.state
        self.assertEqual(self.state.due()[0], record["eventId"])
        self.assertTrue(self.agent.deliver_once())
        self.assertIsNone(self.state.due())
        self.assertEqual(self.outbound[0].full_url,
                         "https://api.example.test/api/edge/truck-gateway-1/events")
        self.assertEqual(self.outbound[0].get_method(), "POST")
        self.assertIsNotNone(self.outbound[0].get_header("X-edge-signature"))

    def test_invalid_gps_and_impossible_coordinates_rejected(self):
        event = sample()
        event["data"]["latitude"] = 91
        with self.assertRaises(ValueError):
            validate_event(event, {"truck-42"})
        self.assertEqual(self.agent.ingest(json.dumps(event).encode(), "a" * 40)[0], 400)
        event = sample()
        event["data"]["vehicleId"] = "other-truck"
        self.assertEqual(self.agent.ingest(json.dumps(event).encode(), "a" * 40)[0], 400)
        event = sample()
        event["data"]["startEngine"] = True
        self.assertEqual(self.agent.ingest(json.dumps(event).encode(), "a" * 40)[0], 400)
        self.assertIsNone(self.state.due())

    def test_warehouse_sensor_shape(self):
        event = {
            **sample(), "eventId": str(uuid4()), "sourceId": "warehouse-temp-1",
            "kind": "warehouse_sensor",
            "data": {"warehouseId": "warehouse-A", "assetId": "cold-room-01",
                     "metric": "temperature", "value": 4.5, "unit": "degC"}
        }
        self.assertEqual(self.agent.ingest(json.dumps(event).encode(), "a" * 40)[0], 202)

    def test_conflicting_event_id_is_not_overwritten(self):
        event = sample()
        self.agent.ingest(json.dumps(event).encode(), "a" * 40)
        event["data"]["longitude"] = 35
        self.assertEqual(self.agent.ingest(json.dumps(event).encode(), "a" * 40)[0], 400)

    def test_full_queue_never_discards_unacknowledged_events(self):
        self.state.conn.close()
        self.state = EdgeState(self.path, max_pending=1)
        self.agent.state = self.state
        from uuid import uuid4
        first = sample()
        second = sample()
        second["eventId"] = str(uuid4())
        self.assertEqual(self.agent.ingest(json.dumps(first).encode(), "a" * 40)[0], 202)
        self.assertEqual(self.agent.ingest(json.dumps(second).encode(), "a" * 40)[0], 503)
        self.assertEqual(self.state.due()[0], first["eventId"])

    def test_external_plaintext_and_embedded_credentials_denied(self):
        for endpoint in ("http://external.example", "https://user:pass@external.example"):
            with self.assertRaises(ValueError):
                EdgeAgent(self.state, "truck-gateway-1", {"truck-42"},
                          "a"*40, "b"*40, endpoint)


if __name__ == "__main__":
    unittest.main()
