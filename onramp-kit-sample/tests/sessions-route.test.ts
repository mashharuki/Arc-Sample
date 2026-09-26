import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSameOrigin } from "@/lib/onramp/authorize";

const ADDR = "0x22e24e551daa46183e5b41db72a54922f816c449";

function req(init: { method?: string; origin?: string | null; body?: unknown; url?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", host: "localhost:3000" });
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://localhost:3000");
  return new Request(init.url ?? "http://localhost:3000/api/onramp/sessions", {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("isSameOrigin", () => {
  it("Origin と Host が一致すれば許可", () => expect(isSameOrigin(req())).toBe(true));
  it("別オリジンは拒否", () => expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false));
  it("Origin が無ければ拒否 (fail-closed)", () => expect(isSameOrigin(req({ origin: null }))).toBe(false));
});

describe("POST /api/onramp/sessions (mock モード)", () => {
  beforeEach(() => {
    vi.stubEnv("ONRAMP_MODE", "mock");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("正常: 200 と no-store", async () => {
    const { POST } = await import("@/app/api/onramp/sessions/route");
    const res = await POST(req({ body: { appUserId: "u1", destinationAddress: ADDR } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toHaveProperty("sessionToken");
  });

  it("別オリジンは 401", async () => {
    const { POST } = await import("@/app/api/onramp/sessions/route");
    const res = await POST(req({ origin: "https://evil.example", body: { appUserId: "u1", destinationAddress: ADDR } }));
    expect(res.status).toBe(401);
  });

  it("宛先なしは 400", async () => {
    const { POST } = await import("@/app/api/onramp/sessions/route");
    const res = await POST(req({ body: { appUserId: "u1" } }));
    expect(res.status).toBe(400);
  });

  it("POST 以外は 405", async () => {
    const { POST } = await import("@/app/api/onramp/sessions/route");
    const res = await POST(req({ method: "GET" }));
    expect(res.status).toBe(405);
  });
});
