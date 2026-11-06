import { test, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import app from "../app";
import { connection } from "../config/db";
import { getJwtSecret, getAllowedOrigins } from "../config/security";
import { nodeRedPackages } from "./service";

const workspaceId = randomUUID(),
  sessionId = randomUUID();
const token = () =>
  jwt.sign({ id: 7, sid: sessionId }, getJwtSecret(), {
    expiresIn: "5m",
    issuer: "imsop-api",
    audience: "imsop-web",
  });
after(() => connection.end());
test("every management route requires a current administrator workspace session and cookie Origin", async (t) => {
  let role = "admin",
    workspace: string | null = workspaceId,
    current = true,
    calls = 0;
  t.mock.method(connection, "query", (async () => ({
    rows: current
      ? [
          {
            id: 7,
            email: "fixture@logistics.test",
            role,
            session_id: sessionId,
            workspace_id: workspace,
            dotnet_organization_id: null,
          },
        ]
      : [],
    rowCount: current ? 1 : 0,
  })) as never);
  for (const method of [
    "targets",
    "status",
    "review",
    "install",
    "reconcile",
  ] as const)
    t.mock.method(nodeRedPackages, method, (async (actor: any) => {
      calls++;
      assert.deepEqual(actor, { id: 7, sessionId, workspaceId });
      return { isolated: true };
    }) as never);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/edge/node-red`;
  const inputs = [
    ["GET", "", undefined],
    ["GET", "/fixture/status", undefined],
    [
      "POST",
      "/fixture/review",
      { module: "node-red-contrib-fixture", version: "1.2.3" },
    ],
    [
      "POST",
      "/fixture/install",
      {
        requestId: randomUUID(),
        reviewToken: "synthetic",
        acknowledgeCodeExecution: true,
      },
    ],
    ["POST", "/fixture/reconcile", {}],
  ] as const;
  const send = (
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    for (const [method, path, body] of inputs) {
      assert.equal((await send(method, path, body)).status, 401);
      assert.equal(
        (await send(method, path, body, { Authorization: "Bearer mock_token" }))
          .status,
        401,
      );
      role = "engineer";
      assert.equal(
        (await send(method, path, body, { Authorization: "Bearer " + token() }))
          .status,
        403,
      );
      role = "admin";
      workspace = null;
      assert.equal(
        (await send(method, path, body, { Authorization: "Bearer " + token() }))
          .status,
        403,
      );
      workspace = workspaceId;
      current = false;
      assert.equal(
        (await send(method, path, body, { Authorization: "Bearer " + token() }))
          .status,
        401,
      );
      current = true;
    }
    assert.equal(calls, 0);
    assert.equal(
      (
        await send("POST", "/fixture/review", inputs[2][2], {
          Cookie: "imsop_access=" + token(),
          Origin: "https://untrusted.example.test",
        })
      ).status,
      403,
    );
    assert.equal(calls, 0);
    for (const [method, path, body] of inputs) {
      const response = await send(method, path, body, {
        Cookie: "imsop_access=" + token(),
        Origin: getAllowedOrigins()[0],
      });
      assert.equal(response.status, path.endsWith("/install") ? 202 : 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    assert.equal(calls, 5);
    for (const [path, body] of [
      ["/fixture/review", { module: "file:/tmp/nodes", version: "latest" }],
      [
        "/fixture/install",
        { ...inputs[3][2], acknowledgeCodeExecution: false },
      ],
      ["/fixture/reconcile", { adminUrl: "https://arbitrary.example.test" }],
    ] as const)
      assert.equal(
        (await send("POST", path, body, { Authorization: "Bearer " + token() }))
          .status,
        400,
      );
    assert.equal(calls, 5);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
