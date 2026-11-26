import { afterEach, describe, expect, it, vi } from "vitest";
import { getCloudflareSiteAnalytics } from "@/lib/stats/cloudflare";
import { buildSevenDayVisitorTrend } from "@/lib/stats/trend";

describe("cloudflare site analytics client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("queries signed api-worker /analytics/site first when workerUrl and workerSecret exist", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          source: "cloudflare",
          range: "30d",
          windowDays: 30,
          visitors: 42,
          views: 78,
          previousVisitors: null,
          previousViews: null,
          daily: [{ day: "2026-11-26", visitors: 42, views: 78 }],
          countries: [{ code: "KE", name: "Kenya", visitors: 30, views: 55 }],
          referrers: [{ source: "google.com", visitors: 22, views: 40 }],
          pages: [{ path: "/", visitors: 40, views: 60 }],
          devices: [{ device: "Mobile", visitors: 28, views: 50 }],
          hostnames: ["bakery.get-on.tech"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await getCloudflareSiteAnalytics({
      hostnames: ["bakery.get-on.tech"],
      range: "30d",
      workerUrl: "https://api.get-on.tech",
      workerSecret: "shared-secret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(res.ok).toBe(true);
    expect(res.via).toBe("worker");
    expect(res.visitors).toBe(42);
    expect(res.countries[0]?.name).toBe("Kenya");
    expect(res.referrers[0]?.source).toBe("google.com");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.get-on.tech/analytics/site");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-gs-host"]).toBe("api.get-on.tech");
    expect(headers["x-gs-sig"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("falls back to direct Cloudflare GraphQL when worker returns ANALYTICS_NOT_CONFIGURED", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: "ANALYTICS_NOT_CONFIGURED" }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              viewer: {
                zones: [
                  {
                    daily: [{ count: 12, sum: { visits: 8 }, dimensions: { date: today } }],
                    countries: [{ count: 12, sum: { visits: 8 }, dimensions: { clientCountryName: "US" } }],
                    referrers: [{ count: 12, sum: { visits: 8 }, dimensions: { clientRefererHost: "instagram.com" } }],
                    pages: [{ count: 12, sum: { visits: 8 }, dimensions: { clientRequestPath: "/" } }],
                    devices: [{ count: 12, sum: { visits: 8 }, dimensions: { clientDeviceType: "desktop" } }],
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const res = await getCloudflareSiteAnalytics({
      hostnames: ["bakery.get-on.tech"],
      range: "7d",
      workerUrl: "https://api.get-on.tech",
      workerSecret: "shared-secret",
      apiToken: "cf-direct-token",
      zoneId: "zone-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(res.ok).toBe(true);
    expect(res.via).toBe("direct");
    expect(res.visitors).toBe(8);
    expect(res.views).toBe(12);
    expect(res.countries[0]).toMatchObject({ code: "US", name: "United States" });
    expect(res.referrers[0]?.source).toBe("instagram.com");
  });

  it("returns clear unconfigured state when neither worker nor direct token exists", async () => {
    const res = await getCloudflareSiteAnalytics({
      hostnames: ["bakery.get-on.tech"],
      range: "30d",
      workerUrl: "",
      workerSecret: "",
      apiToken: "",
    });

    expect(res.ok).toBe(false);
    expect(res.via).toBe("none");
    expect(res.errorCode).toBe("ANALYTICS_NOT_CONFIGURED");
  });
});

describe("buildSevenDayVisitorTrend", () => {
  it("builds a continuous 7-day chronological series and zero-fills missing days", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const series = buildSevenDayVisitorTrend(
      [
        { day: "2026-11-26", visitors: 15, views: 29 },
        { day: "2026-11-24", visitors: 7, views: 11 },
        { day: "2026-11-18", visitors: 99, views: 120 },
      ],
      now,
    );

    expect(series).toHaveLength(7);
    expect(series.map((p) => p.day)).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ]);
    expect(series.map((p) => p.visitors)).toEqual([0, 0, 0, 0, 7, 0, 15]);
    expect(series[4]?.label).toBe("Nov 24");
    expect(series[6]?.label).toBe("Nov 26");
  });
});
