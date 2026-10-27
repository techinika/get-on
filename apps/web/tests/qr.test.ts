import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrPdf, qrPng, qrSvg } from "@/lib/links/qr";

const URL = "https://acme.get-on.tech/_l/abcdefgh";

describe("QR output", () => {
  it("encodes a scannable PNG", async () => {
    const bytes = await qrPng(URL);
    const png = PNG.sync.read(Buffer.from(bytes));
    expect(png.width).toBe(1024);
    expect(png.height).toBe(1024);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(URL);
  });

  it("makes an SVG and a PDF", async () => {
    const svg = await qrSvg(URL);
    expect(svg).toContain("<svg");
    const pdf = await qrPdf({ url: URL, businessName: "Acme", address: "https://acme.get-on.tech" });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
