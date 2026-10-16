import { describe, expect, it, vi } from "vitest";
import { runAgentOnSource, type AgentApi } from "@/lib/client/agent-run";
import { ApiError } from "@/lib/client/api";
import type { ExtractRequest, ExtractStatusResponse } from "@/lib/types";

const req = { criteria: {}, source: { url: "https://a.com" } } as unknown as ExtractRequest;

function fakeApi(statuses: Array<ExtractStatusResponse | Error>): AgentApi & { cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn().mockResolvedValue(undefined);
  let i = 0;
  return {
    cancel,
    extractStart: async () => ({ run_id: "run_1" }),
    extractStatus: async () => {
      const s = statuses[Math.min(i++, statuses.length - 1)];
      if (s instanceof Error) throw s;
      return s;
    },
    extractCancel: cancel,
  };
}

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

describe("runAgentOnSource", () => {
  it("polls until the run completes", async () => {
    const api = fakeApi([{ state: "running", status: "RUNNING" }, { state: "running", status: "RUNNING" }, { state: "done", jobs: [{ title: "A" }], dropped: 0, steps: 3 }]);
    const r = await runAgentOnSource(api, "k", req, clock());
    expect(r.jobs).toHaveLength(1);
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it("times out at the deadline, cancels the run and says so", async () => {
    const api = fakeApi([{ state: "running", status: "RUNNING" }]);
    const err = await runAgentOnSource(api, "k", req, { ...clock(), deadlineMs: 10_000, intervalMs: 3_000 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("TIMEOUT");
    expect(api.cancel).toHaveBeenCalledWith("k", "run_1");
  });

  it("surfaces run failures immediately with the TinyFish code", async () => {
    const api = fakeApi([{ state: "failed", code: "SITE_BLOCKED", message: "blocked", retry_after: null }]);
    await expect(runAgentOnSource(api, "k", req, clock())).rejects.toMatchObject({ code: "SITE_BLOCKED" });
  });

  it("tolerates transient poll errors but gives up after three in a row", async () => {
    const net = new ApiError("net", "NETWORK_ERROR", 0, null);
    const ok = fakeApi([net, net, { state: "done", jobs: [], dropped: 0, steps: 1 }]);
    await expect(runAgentOnSource(ok, "k", req, clock())).resolves.toMatchObject({ jobs: [] });
    const dead = fakeApi([net]);
    await expect(runAgentOnSource(dead, "k", req, clock())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("stops immediately on auth errors", async () => {
    const api = fakeApi([new ApiError("rejected", "INVALID_API_KEY", 401, null)]);
    await expect(runAgentOnSource(api, "k", req, clock())).rejects.toMatchObject({ status: 401 });
  });
});
