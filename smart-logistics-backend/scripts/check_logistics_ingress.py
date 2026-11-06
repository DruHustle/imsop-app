"""Read-only checks for Logistics' own network and remotely managed tunnel.

No provider requests, installation or service changes occur. Credential file
contents are never read; raw service/container metadata is never printed.
A supplied provider response is checked for consistency, not authenticated here.
Even successful local checks do not prove public routing or a completed cutover.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import stat
import subprocess
import sys
import uuid


ROOT = Path(__file__).resolve().parents[1]
ORACLE = ROOT / "deploy/oracle"
UNIT = "onesa-logistics-tunnel.service"
INSTALLED_UNIT = Path("/etc/systemd/system") / UNIT
CREDENTIAL = Path("/etc/onesa/backends/tunnel-logistics.token")
BINARY = Path("/usr/local/lib/onesa-tunnel/cloudflared-2026.10.3")
# Official raw Linux ARM64 asset 662571615 in cloudflare/cloudflared release
# 419581975 (2026.10.3). This is not the different .deb asset's checksum.
# https://github.com/cloudflare/cloudflared/releases/tag/2026.10.3
BINARY_SHA256 = "89297ebfb9e8c99c0dc013a1140601453cf3798d8306c5591651f4a3f5210be8"
BINARY_BYTES = 37652905
PROJECT = "imsop-app-backend"
CONTAINER = "imsop-app-backend-app-1"
NETWORK = "imsop-app-backend-runtime"
DATABASE_NETWORK = "onesa-logistics-database"
DOCKER = ("/usr/bin/docker", "--host", "unix:///run/docker.sock")
EXPECTED_CONFIG = {
    "ingress": [
        {"hostname": "logistics-api.onesa.eu", "service": "http://127.0.0.1:11001"},
        {"service": "http_status:404"},
    ],
    "warp-routing": {"enabled": False},
}
CONTAINER_FORMAT = (
    '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},'
    '"running":{{json .State.Running}},'
    '"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},'
    '"project":{{json (index .Config.Labels "com.docker.compose.project")}},'
    '"service":{{json (index .Config.Labels "com.docker.compose.service")}},'
    '"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}},'
    '"ports":{{json .NetworkSettings.Ports}},'
    '"networks":{{json .NetworkSettings.Networks}},"mounts":{{json .Mounts}}}'
)
NETWORK_FORMAT = (
    '{"id":{{json .Id}},"name":{{json .Name}},"driver":{{json .Driver}},'
    '"scope":{{json .Scope}},"internal":{{json .Internal}},'
    '"project":{{json (index .Labels "com.docker.compose.project")}},'
    '"network":{{json (index .Labels "com.docker.compose.network")}},'
    '"containers":{{json .Containers}}}'
)
UNIT_PROPERTIES = (
    "Id", "LoadState", "ActiveState", "SubState", "MainPID", "FragmentPath",
    "DropInPaths", "Environment", "EnvironmentFiles", "PassEnvironment", "ExecStart",
    "NeedDaemonReload",
)


class CheckError(ValueError):
    """Only fixed messages: never interpolate private input or command output."""


def require(condition, message):
    if not condition:
        raise CheckError(message)


def matches(value, pattern):
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def decode_json(data):
    try:
        def reject_constant(_value):
            raise CheckError("Non-finite JSON values are not allowed")
        return json.loads(data, object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise CheckError("Invalid JSON input") from exc


def read_json(path):
    try:
        with Path(path).open("rb") as stream:
            data = stream.read(1024 * 1024 + 1)
    except OSError as exc:
        raise CheckError("Cannot read the selected JSON input") from exc
    require(len(data) <= 1024 * 1024, "JSON input exceeds the bounded size")
    return decode_json(data)


def check_config(config):
    require(isinstance(config, dict), "Missing tunnel configuration")
    require(set(config) <= {"ingress", "originRequest", "warp-routing"},
            "Unreviewed tunnel configuration field")
    require(config.get("originRequest", {}) == {}, "Origin overrides are not reviewed")
    routing = config.get("warp-routing", {"enabled": False})
    require(isinstance(routing, dict) and set(routing) == {"enabled"}
            and routing["enabled"] is False,
            "Private tunnel routing must remain disabled")
    ingress = config.get("ingress")
    require(isinstance(ingress, list) and len(ingress) == 2,
            "Require exactly one Logistics route and the terminal refusal")
    for actual, expected in zip(ingress, EXPECTED_CONFIG["ingress"]):
        require(isinstance(actual, dict), "Invalid ingress rule")
        require(actual.get("originRequest", {}) == {}, "Origin overrides are not reviewed")
        normalized = {key: value for key, value in actual.items() if key != "originRequest"}
        require(normalized == expected, "Ingress host, origin or terminal refusal differs")


def check_provider_response(document, account_id, tunnel_id):
    require(isinstance(account_id, str) and re.fullmatch(r"[0-9a-f]{32}", account_id),
            "Require the selected account identifier")
    try:
        canonical_id = str(uuid.UUID(tunnel_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise CheckError("Require the selected tunnel UUID") from exc
    require(tunnel_id == canonical_id, "Require a canonical tunnel UUID")
    require(isinstance(document, dict) and document.get("success") is True
            and document.get("errors") == [], "Require a successful configuration GET response")
    result = document.get("result")
    require(isinstance(result, dict), "Missing provider configuration result")
    require(result.get("account_id") == account_id and result.get("tunnel_id") == tunnel_id,
            "Provider account or tunnel identity differs")
    require(result.get("source") == "cloudflare", "Require remotely managed configuration")
    require(type(result.get("version")) is int and result["version"] >= 0,
            "Missing provider configuration version")
    check_config(result.get("config"))


def run_readonly(command):
    # Ignore inherited Docker contexts, proxy variables and caller CLI configuration.
    environment = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
    try:
        result = subprocess.run(command, capture_output=True, text=True,
                                timeout=20, check=False, env=environment)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CheckError("A required local read-only command was unavailable") from exc
    require(result.returncode == 0, "A required local read-only command failed")
    require(len(result.stdout) <= 1024 * 1024, "Local metadata exceeds the bounded size")
    return result.stdout


def check_custody(path, private=False):
    try:
        metadata = path.lstat()
        parents = [parent.lstat() for parent in path.parents]
    except OSError as exc:
        raise CheckError("A required installed file is unavailable") from exc
    require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid == 0,
            "Installed files must be regular and root-owned")
    require(not metadata.st_mode & (0o077 if private else 0o022),
            "Installed file permissions are not sufficiently restricted")
    require(all(stat.S_ISDIR(parent.st_mode) and parent.st_uid == 0
                and not parent.st_mode & 0o022 for parent in parents),
            "Installed file parent custody is not trusted")
    return metadata


def digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_properties(text):
    result = {}
    for line in text.splitlines():
        key, separator, value = line.partition("=")
        require(separator and key in UNIT_PROPERTIES and key not in result,
                "Unexpected systemd metadata")
        result[key] = value
    require(set(result) == set(UNIT_PROPERTIES), "Incomplete systemd metadata")
    return result


def check_systemd(properties):
    require(isinstance(properties, dict) and set(properties) == set(UNIT_PROPERTIES)
            and all(isinstance(value, str) for value in properties.values()),
            "Incomplete or invalid systemd metadata")
    require(properties["Id"] == UNIT and properties["LoadState"] == "loaded"
            and properties["ActiveState"] == "active" and properties["SubState"] == "running"
            and properties["MainPID"].isdigit() and int(properties["MainPID"]) > 0,
            "The dedicated Logistics tunnel unit is not running")
    require(properties["FragmentPath"] == str(INSTALLED_UNIT), "Unexpected installed unit path")
    require(properties["NeedDaemonReload"] == "no", "Systemd has not loaded the installed unit")
    require(not any(properties[name] for name in
                    ("DropInPaths", "Environment", "EnvironmentFiles", "PassEnvironment")),
            "Unreviewed systemd overrides or environment")
    argv = " ".join(process_arguments())
    effective = properties["ExecStart"]
    require(effective.count("argv[]=") == 1 and effective.count("path=") == 1
            and f"path={BINARY} ;" in effective and f"argv[]={argv} ;" in effective,
            "Effective tunnel command differs from the reviewed command")


def check_credential_binding(value):
    # systemctl v255 cannot print this a(ss) property; use its typed D-Bus value.
    require(value == {"type": "a(ss)", "data": [["tunnel-token", str(CREDENTIAL)]]},
            "Effective credential binding differs from the Logistics credential")


def process_arguments():
    return [str(BINARY), "--no-autoupdate", "tunnel", "--metrics", "127.0.0.1:0", "run",
            "--token-file", f"/run/credentials/{UNIT}/tunnel-token"]


def check_running_process(pid):
    process = Path("/proc") / pid
    require(os.readlink(process / "exe") == str(BINARY)
            and digest_file(process / "exe") == BINARY_SHA256,
            "Running tunnel executable differs from the approved binary")
    with (process / "cmdline").open("rb") as stream:
        raw = stream.read(8193)
    require(len(raw) <= 8192, "Running tunnel command exceeds the bounded size")
    require(raw == b"\0".join(value.encode() for value in process_arguments()) + b"\0",
            "Running tunnel arguments differ from the reviewed command")


def check_docker_version(value):
    require(isinstance(value, str), "Missing local Docker version")
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:[-+][A-Za-z0-9._-]+)?", value)
    require(match is not None and tuple(map(int, match.groups())) >= (28, 0, 0),
            "Require Docker Engine 28 or later for loopback publication isolation")


def check_container(container, network, revision, database_network=None):
    require(matches(revision, r"[0-9a-f]{40}"), "Require the approved app revision")
    require(isinstance(container, dict) and isinstance(network, dict), "Invalid Docker metadata")
    require(container.get("name") == "/" + CONTAINER and container.get("project") == PROJECT
            and container.get("service") == "app" and container.get("revision") == revision,
            "Logistics container or source identity differs")
    require(matches(container.get("id"), r"[0-9a-f]{64}")
            and matches(container.get("image"), r"sha256:[0-9a-f]{64}"),
            "Missing immutable container or image identity")
    require(container.get("running") is True and container.get("health") == "healthy",
            "The Logistics app is not running and healthy")
    ports = container.get("ports")
    require(isinstance(ports, dict), "Missing published-port metadata")
    published = {key: value for key, value in ports.items() if value}
    require(published == {"10000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "11001"}]},
            "Require only the retained loopback Logistics origin")
    networks = container.get("networks")
    require(isinstance(networks, dict) and NETWORK in networks
            and set(networks) <= {NETWORK, DATABASE_NETWORK},
            "Logistics is still attached to an unreviewed or shared ingress network")
    require(network.get("name") == NETWORK and network.get("project") == PROJECT
            and network.get("network") == "runtime" and network.get("driver") == "bridge"
            and network.get("scope") == "local" and network.get("internal") is False,
            "Runtime network is not the independent Logistics Compose network")
    require(matches(network.get("id"), r"[0-9a-f]{64}")
            and isinstance(networks[NETWORK], dict)
            and networks[NETWORK].get("NetworkID") == network["id"],
            "Runtime network identity differs")
    members = network.get("containers")
    require(isinstance(members, dict) and set(members) == {container["id"]}
            and isinstance(members[container["id"]], dict)
            and members[container["id"]].get("Name") == CONTAINER,
            "Another container is attached to the Logistics runtime network")
    if DATABASE_NETWORK in networks:
        require(isinstance(database_network, dict), "Missing optional database network inspection")
        require(database_network.get("name") == DATABASE_NETWORK
                and database_network.get("project") == DATABASE_NETWORK
                and database_network.get("network") == "database"
                and database_network.get("driver") == "bridge"
                and database_network.get("scope") == "local"
                and database_network.get("internal") is True,
                "Optional database network is not independently owned and internal")
        attachment = networks[DATABASE_NETWORK]
        require(matches(database_network.get("id"), r"[0-9a-f]{64}")
                and isinstance(attachment, dict)
                and attachment.get("NetworkID") == database_network["id"],
                "Optional database network identity differs")
        members = database_network.get("containers")
        require(isinstance(members, dict) and container["id"] in members
                and isinstance(members[container["id"]], dict)
                and members[container["id"]].get("Name") == CONTAINER,
                "Logistics is missing from the inspected database network")
        require(all(matches(key, r"[0-9a-f]{64}") and isinstance(member, dict)
                    and member.get("Name") in {CONTAINER, DATABASE_NETWORK + "-postgres-1"}
                    for key, member in members.items()),
                "An unrelated container is attached to the Logistics database network")
    else:
        require(database_network is None, "Unexpected database network evidence")
    mounts = container.get("mounts")
    require(isinstance(mounts, list), "Missing mount metadata")
    for mount in mounts:
        require(isinstance(mount, dict), "Invalid mount metadata")
        source = mount.get("Source", "")
        require(isinstance(source, str)
                and not re.search(r"smart[-_]factory|basyx|company[-_]portal", source, re.I),
                "Logistics retains a sibling application's mounted resource")


def inspect_host(revision, runner=run_readonly):
    require(sys.platform == "linux" and platform.machine() in {"aarch64", "arm64"},
            "Host inspection requires the reviewed Linux ARM64 host")
    require(os.geteuid() == 0, "Host inspection requires existing authorized root access")
    check_custody(INSTALLED_UNIT)
    require(INSTALLED_UNIT.read_bytes() == (ORACLE / UNIT).read_bytes(),
            "Installed unit differs from the reviewed source")
    credential = check_custody(CREDENTIAL, private=True)  # Never open the token.
    require(0 < credential.st_size <= 65536, "Credential file metadata is invalid")
    metadata = check_custody(BINARY)
    require(metadata.st_mode & 0o111 and metadata.st_size == BINARY_BYTES
            and digest_file(BINARY) == BINARY_SHA256,
            "Installed tunnel binary differs from the approved official ARM64 asset")
    properties = parse_properties(runner([
        "/usr/bin/systemctl", "show", UNIT,
        "--property=" + ",".join(UNIT_PROPERTIES), "--no-pager",
    ]))
    check_systemd(properties)
    check_credential_binding(decode_json(runner([
        "/usr/bin/busctl", "--system", "--json=short", "get-property",
        "org.freedesktop.systemd1",
        "/org/freedesktop/systemd1/unit/onesa_2dlogistics_2dtunnel_2eservice",
        "org.freedesktop.systemd1.Service", "LoadCredential",
    ])))
    check_running_process(properties["MainPID"])
    check_docker_version(decode_json(runner([*DOCKER, "version", "--format", "{{json .Server.Version}}"])))
    container = decode_json(runner([*DOCKER, "container", "inspect", "--format", CONTAINER_FORMAT, CONTAINER]))
    network = decode_json(runner([*DOCKER, "network", "inspect", "--format", NETWORK_FORMAT, NETWORK]))
    database_network = None
    if (isinstance(container, dict) and isinstance(container.get("networks"), dict)
            and DATABASE_NETWORK in container["networks"]):
        database_network = decode_json(runner([
            *DOCKER, "network", "inspect", "--format", NETWORK_FORMAT, DATABASE_NETWORK,
        ]))
    check_container(container, network, revision, database_network)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider-config", type=Path,
                        help="Private fresh configuration GET response; never a tunnel token")
    parser.add_argument("--account-id", help="Independently selected provider account")
    parser.add_argument("--tunnel-id", help="Independently selected dedicated tunnel UUID")
    parser.add_argument("--check-host", action="store_true", help="Read selected local systemd/Docker metadata")
    parser.add_argument("--expect-revision", help="Approved installed Logistics app commit")
    args = parser.parse_args(argv)
    try:
        candidate = read_json(ORACLE / "tunnel-config.json")
        require(isinstance(candidate, dict) and set(candidate) == {"config"}, "Invalid source payload")
        check_config(candidate["config"])
        checks = ["source_remote_configuration"]
        if args.provider_config is not None:
            check_provider_response(read_json(args.provider_config), args.account_id, args.tunnel_id)
            checks.append("supplied_provider_configuration_consistency")
        else:
            require(not args.account_id and not args.tunnel_id and not args.check_host,
                    "Provider configuration and selected identities are required")
        if args.check_host:
            require(matches(args.expect_revision, r"[0-9a-f]{40}"),
                    "Require the approved installed app revision")
            inspect_host(args.expect_revision)
            checks.append("local_unit_binary_and_container_prerequisites")
        else:
            require(args.expect_revision is None, "App revision requires host inspection")
        print(json.dumps({"checksPassed": checks, "liveVerified": False,
                          "remaining": "Verify provider connector identity, DNS/TLS, external origin refusal, "
                                       "proxy trust, scoped browser workflows and independent rollback."}))
        return 0
    except (CheckError, OSError) as exc:
        # OSError paths or subprocess output can contain private operating data.
        message = str(exc) if isinstance(exc, CheckError) else "An installed file could not be inspected"
        print(json.dumps({"error": message, "liveVerified": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
