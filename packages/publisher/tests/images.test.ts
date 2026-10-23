import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareImage, prepareImages } from "../src/images";
import { buildSite, type BuildSiteInput } from "../index";

async function aPhoto(width = 1200, height = 800): Promise<Uint8Array> {
  const body = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 120, b: 80 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(body);
}

describe("prepareImage", () => {
  it("makes a smaller copy of the picture for the web", async () => {
    const photo = await aPhoto();
    const result = await prepareImage({
      id: "11111111-1111-4111-8111-111111111111",
      bytes: photo,
      alt: "A loaf of bread",
    });

    const names = Object.keys(result.files);
    expect(names.some((name) => name.endsWith(".webp"))).toBe(true);
    expect(names.some((name) => name.endsWith(".jpg"))).toBe(true);
    expect(result.prepared.srcSet).toContain("320w");
    expect(result.prepared.srcSet).toContain("1200w");
    expect(result.prepared.alt).toBe("A loaf of bread");
  });

  it("keeps the picture smaller than the original", async () => {
    const photo = await aPhoto();
    const result = await prepareImage({
      id: "11111111-1111-4111-8111-111111111111",
      bytes: photo,
    });
    const largest = Object.entries(result.files)
      .filter(([name]) => name.endsWith(".webp"))
      .sort((a, b) => Number(b[1].size) - Number(a[1].size))[0];
    expect(largest).toBeTruthy();
  });

  it("gives the same file name to the same picture", async () => {
    const photo = await aPhoto();
    const first = await prepareImage({
      id: "11111111-1111-4111-8111-111111111111",
      bytes: photo,
    });
    const second = await prepareImage({
      id: "22222222-2222-4222-8222-222222222222",
      bytes: photo,
    });
    expect(Object.keys(first.files)).toEqual(Object.keys(second.files));
  });

  it("leaves out a picture it cannot read", async () => {
    const result = await prepareImages([
      {
        id: "11111111-1111-4111-8111-111111111111",
        bytes: new Uint8Array([1, 2, 3]),
      },
    ]);
    expect(result.images.size).toBe(0);
    expect(result.warnings.length).toBe(1);
  });
});

describe("a website with pictures", () => {
  it("shows the picture in the page with the smaller copies", async () => {
    const photo = await aPhoto();
    const input: BuildSiteInput = {
      siteId: "site-1",
      publishId: "pub-1",
      subdomain: "rosebakery",
      settings: {
        businessName: "Rose Bakery",
        theme: {
          palette: "fresh-green",
          fontPair: "friendly",
          corners: "soft",
        },
        plan: "free",
      },
      pages: [
        {
          id: "page-home",
          slug: "",
          title: "Home",
          blocks: [
            {
              id: "block-0000000001",
              type: "image",
              props: {
                imageId: "11111111-1111-4111-8111-111111111111",
                alt: "A loaf of bread",
                caption: "Baked at 4am",
                size: "medium",
                background: "plain",
              },
            },
          ],
        },
      ],
      images: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          bytes: photo,
          alt: "A loaf of bread",
        },
      ],
    };

    const result = await buildSite(input);
    const html = new TextDecoder().decode(result.files["index.html"]!.body);
    expect(html).toMatch(/srcset="/i);
    expect(html).toContain("A loaf of bread");
    expect(html).toContain("Baked at 4am");
    expect(
      Object.keys(result.files).some((name) => name.startsWith("assets/")),
    ).toBe(true);
  });
});
