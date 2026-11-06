import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NodeRedPackages } from "@/components/NodeRedPackages";
const harness = vi.hoisted(() => ({
  user: { id: "admin-a", role: "admin" },
  mode: "live",
  request: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: harness.user }),
}));
vi.mock("@/contexts/DataContext", () => ({
  useData: () => ({ mode: harness.mode }),
}));
vi.mock("@/lib/requests", () => ({
  requestJSON: (...args: unknown[]) => harness.request(...args),
}));
const target = {
  id: "8d70df1b-5722-4e7f-8dfc-e90cfa875a77",
  gatewayId: "warehouse-fixture",
  label: "Private warehouse fixture",
  version: "4.1.4",
  revision: "a".repeat(64),
};
const review = {
  module: "@fixture/node-red-test",
  version: "1.2.3",
  target,
  description: "Synthetic adapter",
  nodeSets: ["fixture"],
  pluginSets: [],
  reviewToken: "synthetic-signed-review",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const operation = {
  id: "4f1fa60c-7679-4f00-9cfb-e9d779fe6b22",
  runtimeId: target.id,
  gatewayId: target.gatewayId,
  workspaceId: "f1e65463-ce23-4803-a2e4-3f4e1daa5b56",
  targetRevision: target.revision,
  actorId: 7,
  module: review.module,
  version: review.version,
  state: "unconfirmed",
  message: "Synthetic lost acknowledgement",
  startedAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
};
const targets = {
  state: "ready",
  message: "Synthetic enrollment",
  targets: [target],
};
const status = (saved: typeof operation | null = null) => ({
  state: "ready",
  target,
  message: "Synthetic gateway connected",
  packages: [],
  operation: saved,
});
beforeEach(() => {
  harness.mode = "live";
  harness.user = { id: "admin-a", role: "admin" };
  harness.request.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("does not call management for old capabilities, demo mode or a non-administrator", async () => {
  harness.request.mockResolvedValue({ capabilities: ["immutable-mail-v1"] });
  const component = render(<NodeRedPackages />);
  await act(async () => {});
  expect(harness.request.mock.calls.map(call => call[0])).toEqual(["/version"]);
  expect(screen.queryByText("Node-RED packages")).toBeNull();
  harness.request.mockClear();
  harness.mode = "demo";
  component.rerender(<NodeRedPackages />);
  await act(async () => {});
  expect(harness.request).not.toHaveBeenCalled();
  harness.mode = "live";
  harness.user = { id: "engineer-a", role: "engineer" };
  component.rerender(<NodeRedPackages />);
  await act(async () => {});
  expect(harness.request).not.toHaveBeenCalled();
});
it("ignores a late enrollment response after the account changes", async () => {
  let complete!: (value: unknown) => void;
  harness.request.mockImplementation((path: string) =>
    path === "/version"
      ? Promise.resolve({ capabilities: ["node-red-package-management-v1"] })
      : new Promise(resolve => {
          complete = resolve;
        })
  );
  const component = render(<NodeRedPackages />);
  await waitFor(() => expect(harness.request).toHaveBeenCalledTimes(2));
  harness.user = { id: "engineer-a", role: "engineer" };
  component.rerender(<NodeRedPackages />);
  await act(async () => {
    complete(targets);
  });
  expect(screen.queryByText(target.label)).toBeNull();
  expect(screen.queryByText("Node-RED packages")).toBeNull();
  expect(harness.request).toHaveBeenCalledTimes(2);
});
it("one acknowledged install remains blocked after a lost response and remount until read-only reconciliation confirms it", async () => {
  let installs = 0,
    reconciles = 0,
    saved: typeof operation | null = null;
  let rejectInstall!: (error: Error) => void;
  harness.request.mockImplementation(
    (path: string, _method: string, body: any) => {
      if (path === "/version")
        return Promise.resolve({
          capabilities: ["node-red-package-management-v1"],
        });
      if (path === "/api/edge/node-red") return Promise.resolve(targets);
      if (path.endsWith("/status")) return Promise.resolve(status(saved));
      if (path.endsWith("/review")) {
        expect(body).toEqual({
          module: review.module,
          version: review.version,
        });
        return Promise.resolve(review);
      }
      if (path.endsWith("/install")) {
        installs++;
        expect(body.acknowledgeCodeExecution).toBe(true);
        expect(body.reviewToken).toBe(review.reviewToken);
        saved = { ...operation, id: body.requestId };
        return new Promise((_resolve, reject) => {
          rejectInstall = reject;
        });
      }
      if (path.endsWith("/reconcile")) {
        reconciles++;
        expect(body).toEqual({});
        saved = {
          ...saved!,
          state: "installed",
          message: "Read-back confirmed the exact version",
        };
        return Promise.resolve(saved);
      }
      throw Error("Unexpected fixture request");
    }
  );
  const component = render(<NodeRedPackages />);
  await screen.findByText("Synthetic gateway connected");
  fireEvent.change(screen.getByLabelText("Package name"), {
    target: { value: review.module },
  });
  fireEvent.change(screen.getByLabelText("Exact version"), {
    target: { value: review.version },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review exact version" }));
  const install = await screen.findByRole("button", {
    name: "Install reviewed package",
  });
  expect((install as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("checkbox", { name: /I reviewed this package/ })
  );
  act(() => {
    fireEvent.click(install);
    fireEvent.click(install);
  });
  expect(installs).toBe(1);
  await act(async () => rejectInstall(Error("Synthetic lost acknowledgement")));
  expect(
    (
      screen.getByRole("button", {
        name: "Review exact version",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  component.unmount();
  render(<NodeRedPackages />);
  await screen.findByText("unconfirmed", { selector: "strong" });
  expect(
    (
      screen.getByRole("button", {
        name: "Review exact version",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(installs).toBe(1);
  expect(reconciles).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Check saved outcome" }));
  await screen.findByText("Read-back confirmed the exact version");
  expect(installs).toBe(1);
  expect(reconciles).toBe(1);
});
