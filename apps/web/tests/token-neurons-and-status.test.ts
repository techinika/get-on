import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRequestUsage, MODEL_SEEDS } from "@get-on/ai";
import { pagePublishStatus } from "@/lib/publishing/status";

function stripJsonComments(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

describe("token and neuron usage calculation", () => {
  it("combines generation and moderation tokens and neurons", () => {
    const writer = MODEL_SEEDS.find((m) => m.id === "writer-fast")!;
    const guard = MODEL_SEEDS.find((m) => m.id === "guard-default")!;
    const usage = buildRequestUsage({
      model: writer,
      generationUsage: { inputTokens: 1000, outputTokens: 500 },
      moderationInputUsage: { inputTokens: 200, outputTokens: 5 },
      moderationOutputUsage: { inputTokens: 500, outputTokens: 5 },
      guardModel: guard,
      creditNeurons: 100,
    });

    expect(usage.inputTokens).toBe(1000);
    expect(usage.outputTokens).toBe(500);
    expect(usage.moderationInputTokens).toBe(700);
    expect(usage.moderationOutputTokens).toBe(10);
    expect(usage.moderationTotalTokens).toBe(710);
    expect(usage.totalTokens).toBe(2210);
    expect(usage.generationNeurons).toBe(1);
    expect(usage.moderationNeurons).toBe(2);
    expect(usage.totalNeurons).toBe(3);
    expect(usage.neurons).toBe(3);
    expect(usage.creditNeurons).toBe(100);
  });

  it("includes image model neurons plus moderation neurons", () => {
    const imgModel = MODEL_SEEDS.find((m) => m.id === "image-default")!;
    const guard = MODEL_SEEDS.find((m) => m.id === "guard-default")!;
    const usage = buildRequestUsage({
      model: imgModel,
      generationUsage: { inputTokens: 45, images: 1 },
      moderationInputUsage: { inputTokens: 45, outputTokens: 2 },
      guardModel: guard,
      creditNeurons: 100,
    });

    expect(usage.images).toBe(1);
    expect(usage.generationNeurons).toBe(173);
    expect(usage.moderationNeurons).toBe(1);
    expect(usage.totalNeurons).toBe(174);
    expect(usage.totalTokens).toBe(92);
  });
});

describe("page publish status badge resolution", () => {
  const basePage = {
    id: "page-home",
    title: "Home",
    path: "/",
    is_homepage: true,
    blocks: [{ id: "h1", type: "hero", props: { heading: "Welcome" } }],
    updated_at: "2026-11-26T00:00:00.000Z",
  };

  it("marks unchanged pages in a live publish snapshot as live", () => {
    const status = pagePublishStatus({
      projectPublished: true,
      liveAt: "2026-11-26T01:00:00.000Z",
      liveSnapshot: {
        pages: [
          {
            id: "page-home",
            title: "Home",
            path: "/",
            is_homepage: true,
            blocks: [{ props: { heading: "Welcome" }, type: "hero", id: "h1" }],
          },
        ],
      },
      page: basePage,
    });
    expect(status).toBe("live");
  });

  it("marks edited pages whose blocks changed after publishing as changes", () => {
    const status = pagePublishStatus({
      projectPublished: true,
      liveAt: "2026-11-26T01:00:00.000Z",
      liveSnapshot: {
        pages: [
          {
            id: "page-home",
            title: "Home",
            path: "/",
            is_homepage: true,
            blocks: [{ id: "h1", type: "hero", props: { heading: "Old heading" } }],
          },
        ],
      },
      page: basePage,
    });
    expect(status).toBe("changes");
  });

  it("marks new pages missing from the live snapshot or unpublished projects as draft", () => {
    expect(
      pagePublishStatus({
        projectPublished: true,
        liveAt: "2026-11-26T01:00:00.000Z",
        liveSnapshot: { pages: [] },
        page: basePage,
      }),
    ).toBe("draft");

    expect(
      pagePublishStatus({
        projectPublished: false,
        liveAt: null,
        liveSnapshot: null,
        page: basePage,
      }),
    ).toBe("draft");
  });
});

describe("worker observability logs and traces", () => {
  it("enables logs and traces across api-worker and sites-worker wrangler configs", () => {
    for (const worker of ["api-worker", "sites-worker"]) {
      const filePath = path.resolve(process.cwd(), "..", worker, "wrangler.jsonc");
      const parsed = JSON.parse(stripJsonComments(readFileSync(filePath, "utf8"))) as {
        observability?: {
          enabled?: boolean;
          head_sampling_rate?: number;
          logs?: { enabled?: boolean; invocation_logs?: boolean; persist?: boolean };
          traces?: { enabled?: boolean; persist?: boolean };
        };
      };
      expect(parsed.observability?.enabled).toBe(true);
      expect(parsed.observability?.head_sampling_rate).toBe(1);
      expect(parsed.observability?.logs?.enabled).toBe(true);
      expect(parsed.observability?.logs?.invocation_logs).toBe(true);
      expect(parsed.observability?.logs?.persist).toBe(true);
      expect(parsed.observability?.traces?.enabled).toBe(true);
      expect(parsed.observability?.traces?.persist).toBe(true);
    }
  });
});
