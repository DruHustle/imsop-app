"""Independent ingress boundaries with synthetic metadata; no live host/provider."""

import contextlib
import copy
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import check_logistics_ingress as check


ACCOUNT = "0" * 32
TUNNEL = "00000000-0000-4000-8000-000000000001"
REVISION = "c" * 40
CONTAINER_ID = "a" * 64
NETWORK_ID = "b" * 64


def provider_response():
    return {"success": True, "errors": [], "messages": [], "result": {
        "account_id": ACCOUNT, "tunnel_id": TUNNEL, "source": "cloudflare", "version": 1,
        "config": copy.deepcopy(check.EXPECTED_CONFIG),
    }}


def runtime():
    container = {
        "id": CONTAINER_ID, "name": "/" + check.CONTAINER,
        "image": "sha256:" + "d" * 64, "project": check.PROJECT, "service": "app",
        "revision": REVISION, "running": True, "health": "healthy",
        "ports": {"10000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "11001"}]},
        "networks": {check.NETWORK: {"NetworkID": NETWORK_ID}}, "mounts": [],
    }
    network = {
        "id": NETWORK_ID, "name": check.NETWORK, "project": check.PROJECT,
        "network": "runtime", "driver": "bridge", "scope": "local", "internal": False,
        "containers": {CONTAINER_ID: {"Name": check.CONTAINER}},
    }
    return container, network


def database_network(container):
    network_id = "e" * 64
    container["networks"][check.DATABASE_NETWORK] = {"NetworkID": network_id}
    return {
        "id": network_id, "name": check.DATABASE_NETWORK, "project": check.DATABASE_NETWORK,
        "network": "database", "driver": "bridge", "scope": "local", "internal": True,
        "containers": {CONTAINER_ID: {"Name": check.CONTAINER},
                       "f" * 64: {"Name": check.DATABASE_NETWORK + "-postgres-1"}},
    }


def systemd_properties():
    values = {name: "" for name in check.UNIT_PROPERTIES}
    values.update({
        "Id": check.UNIT, "LoadState": "loaded", "ActiveState": "active", "SubState": "running",
        "MainPID": "100", "FragmentPath": str(check.INSTALLED_UNIT), "NeedDaemonReload": "no",
        "ExecStart": "{ path=" + str(check.BINARY) + " ; argv[]="
                     + " ".join(check.process_arguments()) + " ; ignore_errors=no ; pid=100 ; }",
    })
    return values


class RemoteConfigurationTests(unittest.TestCase):
    def test_source_payload_and_provider_get_agree_without_secret_or_target_defaults(self):
        payload = check.read_json(check.ORACLE / "tunnel-config.json")
        self.assertEqual(payload, {"config": check.EXPECTED_CONFIG})
        check.check_provider_response(provider_response(), ACCOUNT, TUNNEL)
        self.assertEqual(payload["config"]["ingress"], [
            {"hostname": "logistics-api.onesa.eu", "service": "http://127.0.0.1:11001"},
            {"service": "http_status:404"},
        ])
        self.assertNotIn("token", json.dumps(payload))

    def test_rejects_redirected_or_expanded_ingress_and_origin_overrides(self):
        changes = [
            lambda c: c["ingress"][0].update(hostname="factory.onesa.eu"),
            lambda c: c["ingress"][0].update(hostname="*.onesa.eu"),
            lambda c: c["ingress"][0].update(service="http://smart-factory-basyx:80"),
            lambda c: c["ingress"][0].update(service="http://0.0.0.0:11001"),
            lambda c: c["ingress"][0].update(path="/api/*"),
            lambda c: c["ingress"][0].update(originRequest={"httpHostHeader": "factory.onesa.eu"}),
            lambda c: c["ingress"][1].update(service="http://127.0.0.1:11001"),
            lambda c: c["ingress"].reverse(),
            lambda c: c["ingress"].append({"service": "ssh://localhost:22"}),
            lambda c: c.update(originRequest={"noTLSVerify": True}),
            lambda c: c.update(**{"warp-routing": {"enabled": True}}),
            lambda c: c.update(**{"warp-routing": {"enabled": 0}}),
            lambda c: c.update(factoryIndependent=True),
        ]
        for change in changes:
            value = copy.deepcopy(check.EXPECTED_CONFIG)
            change(value)
            with self.subTest(value=value), self.assertRaises(check.CheckError):
                check.check_config(value)

    def test_only_inert_provider_defaults_are_accepted(self):
        value = copy.deepcopy(check.EXPECTED_CONFIG)
        value["originRequest"] = {}
        value["ingress"][0]["originRequest"] = {}
        value.pop("warp-routing")
        check.check_config(value)

    def test_provider_account_tunnel_remote_source_and_version_are_bound(self):
        for field, value in (("account_id", "1" * 32), ("tunnel_id", ACCOUNT),
                             ("source", "local"), ("version", None), ("version", True)):
            response = provider_response()
            response["result"][field] = value
            with self.subTest(field=field), self.assertRaises(check.CheckError):
                check.check_provider_response(response, ACCOUNT, TUNNEL)
        for response in ({}, {"success": False}, {"success": True, "errors": [], "result": 1}):
            with self.assertRaises(check.CheckError):
                check.check_provider_response(response, ACCOUNT, TUNNEL)
        with self.assertRaises(check.CheckError):
            check.check_provider_response(provider_response(), "bad", TUNNEL)
        with self.assertRaises(check.CheckError):
            check.check_provider_response(provider_response(), ACCOUNT, "bad")

    def test_duplicate_and_nonfinite_json_is_rejected(self):
        for value in ('{"config":{},"config":{}}', '{"version":NaN}', '{', b'\xff'):
            with self.subTest(value=value), self.assertRaises(check.CheckError):
                check.decode_json(value)

    def test_cli_never_promotes_a_snapshot_to_live_evidence_or_reads_host_by_default(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "response.json"
            path.write_text(json.dumps(provider_response()))
            output = io.StringIO()
            with patch.object(check, "inspect_host", side_effect=AssertionError("no host access")), \
                    contextlib.redirect_stdout(output):
                status = check.main(["--provider-config", str(path), "--account-id", ACCOUNT,
                                     "--tunnel-id", TUNNEL])
            self.assertEqual(status, 0)
            result = json.loads(output.getvalue())
            self.assertIs(result["liveVerified"], False)
            self.assertNotIn(TUNNEL, output.getvalue())
            response = provider_response()
            response["result"]["config"]["ingress"][0]["service"] = "private-sensitive-marker"
            path.write_text(json.dumps(response))
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                self.assertEqual(check.main(["--provider-config", str(path), "--account-id", ACCOUNT,
                                             "--tunnel-id", TUNNEL]), 1)
            self.assertNotIn("private-sensitive-marker", errors.getvalue())


class LocalIsolationTests(unittest.TestCase):
    def test_runtime_and_optional_database_have_separate_inspected_identities(self):
        container, network = runtime()
        check.check_container(container, network, REVISION)
        database = database_network(container)
        check.check_container(container, network, REVISION, database)
        with self.assertRaises(check.CheckError):
            check.check_container(container, network, REVISION)

    def test_legacy_or_foreign_attachments_and_network_members_are_refused(self):
        for name in ("imsop-app-backend-ingress", "smart-factory-basyx_default", "some-other-database"):
            container, network = runtime()
            container["networks"][name] = {"NetworkID": "f" * 64}
            with self.subTest(name=name), self.assertRaises(check.CheckError):
                check.check_container(container, network, REVISION)
        for field, value in (("id", "f" * 64), ("project", "smart-factory-basyx"),
                             ("internal", True), ("network", "ingress"), ("driver", "host")):
            container, network = runtime()
            network[field] = value
            with self.subTest(field=field), self.assertRaises(check.CheckError):
                check.check_container(container, network, REVISION)
        container, network = runtime()
        network["containers"]["f" * 64] = {"Name": "smart-factory-worker"}
        with self.assertRaises(check.CheckError):
            check.check_container(container, network, REVISION)

    def test_database_name_alone_never_establishes_isolation(self):
        for field, value in (("id", "arbitrary"), ("project", "foreign"), ("internal", False),
                             ("network", "default"), ("scope", "swarm")):
            container, network = runtime()
            database = database_network(container)
            database[field] = value
            with self.subTest(field=field), self.assertRaises(check.CheckError):
                check.check_container(container, network, REVISION, database)
        container, network = runtime()
        database = database_network(container)
        database["containers"]["9" * 64] = {"Name": "smart-factory-worker"}
        with self.assertRaises(check.CheckError):
            check.check_container(container, network, REVISION, database)

    def test_public_or_extra_origin_listeners_are_refused(self):
        for ports in (None, [], {"10000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "11001"}]},
                      {"10000/tcp": [{"HostIp": "::", "HostPort": "11001"}]},
                      {"10000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "11002"}]}):
            container, network = runtime()
            container["ports"] = ports
            with self.subTest(ports=ports), self.assertRaises(check.CheckError):
                check.check_container(container, network, REVISION)
        container, network = runtime()
        container["ports"]["80/tcp"] = [{"HostIp": "127.0.0.1", "HostPort": "80"}]
        with self.assertRaises(check.CheckError):
            check.check_container(container, network, REVISION)

    def test_wrong_source_health_mount_or_malformed_identity_fails_closed(self):
        for field, value in (("revision", "e" * 40), ("running", False), ("health", "unhealthy"),
                             ("id", 1), ("image", None), ("networks", []), ("mounts", {}),
                             ("mounts", [{"Source": "/opt/smart-factory-basyx/private"}])):
            container, network = runtime()
            container[field] = value
            with self.subTest(field=field), self.assertRaises(check.CheckError):
                check.check_container(container, network, REVISION)

    def test_effective_systemd_state_and_typed_credential_binding_are_checked(self):
        check.check_systemd(systemd_properties())
        for field, value in (("NeedDaemonReload", "yes"), ("DropInPaths", "/override.conf"),
                             ("Environment", "private-sensitive-marker"), ("MainPID", "0"),
                             ("SubState", "dead"), ("ExecStart", "unreviewed"), ("MainPID", 1)):
            properties = systemd_properties()
            properties[field] = value
            with self.subTest(field=field), self.assertRaises(check.CheckError):
                check.check_systemd(properties)
        binding = {"type": "a(ss)", "data": [["tunnel-token", str(check.CREDENTIAL)]]}
        check.check_credential_binding(binding)
        for value in ({}, {"type": "a(ss)", "data": []},
                      {"type": "a(ss)", "data": [["tunnel-token", "/etc/other.token"]]},
                      {"type": "a(ss)", "data": [binding["data"]]}):
            with self.assertRaises(check.CheckError):
                check.check_credential_binding(value)

    def test_unit_survives_origin_restart_without_sibling_or_public_listener_dependencies(self):
        unit = (check.ORACLE / check.UNIT).read_text()
        self.assertNotIn("Requires=docker.service", unit)
        self.assertNotIn("PartOf=", unit)
        self.assertNotIn("EnvironmentFile=", unit)
        self.assertIn("DynamicUser=yes", unit)
        self.assertIn("LoadCredential=tunnel-token:" + str(check.CREDENTIAL), unit)
        self.assertIn("--metrics 127.0.0.1:0", unit)
        self.assertIn("--token-file %d/tunnel-token", unit)
        self.assertNotRegex(unit.lower(), r"smart-factory|basyx|company-portal|:80\b|:443\b")

    def test_readonly_runner_ignores_remote_docker_context_and_redacts_command_failure(self):
        result = SimpleNamespace(returncode=0, stdout="{}", stderr="")
        with patch.dict(os.environ, {"DOCKER_HOST": "ssh://other-host", "DOCKER_CONTEXT": "other"}), \
                patch.object(subprocess, "run", return_value=result) as run:
            check.run_readonly([*check.DOCKER, "version"])
        command = run.call_args.args[0]
        self.assertEqual(command[:3], ["/usr/bin/docker", "--host", "unix:///run/docker.sock"])
        self.assertNotIn("DOCKER_HOST", run.call_args.kwargs["env"])
        self.assertNotIn("DOCKER_CONTEXT", run.call_args.kwargs["env"])
        result.returncode = 1
        result.stderr = "private-sensitive-marker"
        with patch.object(subprocess, "run", return_value=result), \
                self.assertRaises(check.CheckError) as failure:
            check.run_readonly([*check.DOCKER, "version"])
        self.assertNotIn("private-sensitive-marker", str(failure.exception))

    def test_installed_file_custody_rejects_links_writable_parents_and_public_credentials(self):
        directory = SimpleNamespace(lstat=lambda: SimpleNamespace(st_mode=stat.S_IFDIR | 0o755, st_uid=0))
        metadata = SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0)
        path = SimpleNamespace(lstat=lambda: metadata, parents=[directory])
        check.check_custody(path, private=True)
        for mode, owner in ((stat.S_IFLNK | 0o777, 0), (stat.S_IFREG | 0o644, 0),
                            (stat.S_IFREG | 0o600, 1000)):
            metadata.st_mode, metadata.st_uid = mode, owner
            with self.assertRaises(check.CheckError):
                check.check_custody(path, private=True)
        metadata.st_mode, metadata.st_uid = stat.S_IFREG | 0o600, 0
        directory.lstat = lambda: SimpleNamespace(st_mode=stat.S_IFDIR | 0o777, st_uid=0)
        with self.assertRaises(check.CheckError):
            check.check_custody(path, private=True)

    def test_old_engine_cannot_claim_loopback_publishing_isolation(self):
        for version in ("28.0.0", "29.1.2", "28.1.1+vendor"):
            check.check_docker_version(version)
        for version in (None, "27.5.1", "garbage"):
            with self.assertRaises(check.CheckError):
                check.check_docker_version(version)


if __name__ == "__main__":
    unittest.main()
