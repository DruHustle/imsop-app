import { z } from "zod";
import {
  exactPackageVersion,
  packageSelection,
  type NodeRedPackage,
} from "./contract";
import {
  INSTALL_TIMEOUT_MS,
  MANAGEMENT_PERMISSIONS,
  NodeRedError,
  REQUEST_TIMEOUT_MS,
  type NodeRedConfiguration,
} from "./configuration";

const LIMIT = 1_048_576;
const settingSchema = z.object({
  version: exactPackageVersion,
  user: z.object({
    permissions: z.array(z.string()).max(16),
    anonymous: z.boolean().optional(),
  }),
  externalModules: z.object({
    palette: z.object({
      allowInstall: z.boolean(),
      allowUpdate: z.boolean(),
      allowUpload: z.boolean(),
    }),
  }),
});
const setSchema = z.object({
  module: z.string().min(1).max(214),
  version: z.string().min(1).max(96),
  err: z.unknown().optional(),
  pending_version: z.string().max(96).optional(),
});
const setList = z.array(setSchema).max(10_000);
const moduleSchema = z.object({
  name: z.string(),
  version: exactPackageVersion,
  nodes: setList,
  plugins: setList.optional().default([]),
  pending_version: z.string().max(96).optional(),
});

/** Never return an upstream response body or exception to the browser/logs. */
async function boundedJson(response: Response): Promise<unknown> {
  const size = Number(response.headers.get("content-length"));
  if (
    (size && size > LIMIT) ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  ) {
    await response.body?.cancel();
    throw new NodeRedError(
      "The management service returned an unsupported response.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new NodeRedError(
      "The management service returned an empty response.",
    );
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > LIMIT)
        throw new NodeRedError(
          "The management response exceeded its size limit.",
        );
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof NodeRedError) throw error;
    throw new NodeRedError(
      "The management service returned an unreadable response.",
    );
  } finally {
    reader.releaseLock();
  }
}

export class NodeRedClient {
  constructor(
    readonly config: NodeRedConfiguration,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request(
    path: string,
    install?: { module: string; version: string },
  ) {
    const signal = AbortSignal.timeout(
      install ? INSTALL_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await this.fetcher(this.config.adminUrl + path, {
        method: install ? "POST" : "GET",
        redirect: "error",
        signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.token}`,
          ...(install ? { "Content-Type": "application/json" } : {}),
        },
        ...(install ? { body: JSON.stringify(install) } : {}),
      });
    } catch {
      throw new NodeRedError(
        install
          ? "The installation response was lost or timed out. Its outcome is unconfirmed; check the saved operation before any further installation."
          : "The private Node-RED route is unreachable or timed out. Check the supervised SSH forward.",
      );
    }
    if (
      response.headers.get("x-smart-logistics-node-red-runtime") !==
      this.config.target.id
    ) {
      await response.body?.cancel();
      throw new NodeRedError(
        "The route did not identify the enrolled Node-RED runtime. Installation is unavailable.",
      );
    }
    if (!response.ok) {
      // 401/403 are authoritative pre-handler refusals. Other install failures
      // can follow npm side effects; retain an unconfirmed operation for review.
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        throw new NodeRedError(
          "Node-RED refused the dedicated package-management credential. Review its permissions and rotation.",
          true,
        );
      throw new NodeRedError(
        "Node-RED did not confirm the request. Review the runtime logs and saved installation status.",
      );
    }
    return boundedJson(response);
  }

  async checkRuntime() {
    const result = settingSchema.safeParse(await this.request("/settings"));
    if (!result.success)
      throw new NodeRedError(
        "Node-RED has not been configured with the reviewed package-management policy.",
      );
    const settings = result.data;
    if (settings.version !== this.config.target.version)
      throw new NodeRedError(
        "The running Node-RED version differs from the enrolled version. Review the gateway release before installing packages.",
      );
    const permissions = settings.user.permissions;
    if (
      settings.user.anonymous ||
      permissions.length !== MANAGEMENT_PERMISSIONS.length ||
      !MANAGEMENT_PERMISSIONS.every((permission) =>
        permissions.includes(permission),
      )
    )
      throw new NodeRedError(
        "Use a dedicated Node-RED token with only the reviewed package-management permissions.",
      );
    const palette = settings.externalModules.palette;
    if (!palette.allowInstall || palette.allowUpdate || palette.allowUpload)
      throw new NodeRedError(
        "Node-RED must allow package additions and refuse package updates and archive uploads through this management route.",
      );
  }

  async packages(): Promise<NodeRedPackage[]> {
    const responses = await Promise.all([
      this.request("/nodes"),
      this.request("/plugins"),
    ]);
    const result = new Map<string, NodeRedPackage>();
    responses.forEach((raw, index) => {
      const parsed = setList.safeParse(raw);
      if (!parsed.success)
        throw new NodeRedError(
          "Node-RED returned an unsupported package inventory.",
        );
      for (const set of parsed.data) {
        const current = result.get(set.module) ?? {
          name: set.module,
          version: set.version,
          nodeSets: 0,
          pluginSets: 0,
          loadError: false,
          pendingVersion: null,
        };
        if (current.version !== set.version)
          throw new NodeRedError(
            "The Node-RED package inventory is inconsistent. Review the runtime before installing packages.",
          );
        if (index === 0) current.nodeSets++;
        else current.pluginSets++;
        current.loadError ||= Boolean(set.err);
        current.pendingVersion = set.pending_version ?? current.pendingVersion;
        result.set(set.module, current);
      }
    });
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async installed(selection: { module: string; version: string }) {
    const inventory = await this.packages();
    const match = inventory.find((item) => item.name === selection.module);
    if (!match) return null;
    // The module endpoint also exposes pending versions for plugin-only modules.
    const parsed = moduleSchema.safeParse(
      await this.request("/nodes/" + encodeURIComponent(selection.module)),
    );
    if (!parsed.success || parsed.data.name !== selection.module)
      throw new NodeRedError(
        "Node-RED could not verify the selected package inventory.",
      );
    const module = parsed.data;
    if (module.version !== match.version)
      throw new NodeRedError(
        "The Node-RED inventory changed during verification. Check the saved outcome before another installation.",
      );
    return {
      ...match,
      version: module.version,
      // Do not clear a pending/error signal just because a later endpoint omits
      // it. Inconsistent read-back is insufficient evidence to release the slot.
      pendingVersion: module.pending_version ?? match.pendingVersion,
      loadError:
        match.loadError ||
        [...module.nodes, ...module.plugins].some((set) => Boolean(set.err)),
    };
  }

  async install(selection: { module: string; version: string }) {
    // Revalidate at the final transport boundary. The official version field
    // is separate from module; URL, tarball and local path fields are absent.
    return this.request("/nodes", packageSelection.parse(selection));
  }

  async packageMetadata(selection: { module: string; version: string }) {
    const input = packageSelection.parse(selection);
    let response: Response;
    try {
      response = await this.fetcher(
        `https://registry.npmjs.org/${encodeURIComponent(input.module)}/${encodeURIComponent(input.version)}`,
        {
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      throw new NodeRedError(
        "The npm registry is unavailable. Package review did not start an installation.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new NodeRedError(
        "That exact package version could not be found in the npm registry.",
      );
    }
    const raw = await boundedJson(response);
    const parsed = z
      .object({
        name: z.literal(input.module),
        version: z.literal(input.version),
        description: z.string().max(4_000).optional(),
        "node-red": z.object({
          nodes: z.record(z.string().max(160), z.string().max(1024)).optional(),
          plugins: z
            .record(z.string().max(160), z.string().max(1024))
            .optional(),
        }),
      })
      .safeParse(raw);
    if (!parsed.success)
      throw new NodeRedError(
        "Choose a Node-RED node library or plugin package. General Function-node dependencies use a separate reviewed flow change.",
      );
    const nodeSets = Object.keys(parsed.data["node-red"].nodes ?? {});
    const pluginSets = Object.keys(parsed.data["node-red"].plugins ?? {});
    if (
      (!nodeSets.length && !pluginSets.length) ||
      nodeSets.length + pluginSets.length > 256
    )
      throw new NodeRedError(
        "The package does not declare a supported set of Node-RED nodes or plugins.",
      );
    const clean = (text: string) =>
      text.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500);
    return {
      description: clean(parsed.data.description ?? ""),
      nodeSets: nodeSets.map(clean),
      pluginSets: pluginSets.map(clean),
    };
  }
}
