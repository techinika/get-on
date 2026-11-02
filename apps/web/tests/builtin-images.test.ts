import { describe, expect, it } from "vitest";
import { builtinImageMap, sharedTemplateImages } from "@get-on/templates";
import { builtinTemplateImages } from "@/lib/publishing/builtin-images";
import type { SourcePage } from "@/lib/publishing/build-input";

describe("built-in template images", () => {
  it("maps every built-in image to a static public file", () => {
    for (const [id, image] of builtinImageMap()) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(image.src).toMatch(/^\/template-art\/.+\.webp$/);
      expect(image.alt.length).toBeGreaterThan(5);
    }
  });

  it("loads the bytes used by a page without a Pictures library row", async () => {
    const photo = sharedTemplateImages()[0]!;
    const pages: SourcePage[] = [
      {
        id: "page",
        title: "Home",
        path: "/",
        position: 0,
        is_homepage: true,
        blocks: [{ id: "hero", type: "hero", props: { imageId: photo.id } }],
        show_in_menu: true,
        is_hidden: false,
        seo_title: null,
        seo_description: null,
        hide_from_search: false,
      },
    ];

    const result = await builtinTemplateImages(pages);
    expect(result.media).toEqual([
      expect.objectContaining({ id: photo.id, path: photo.src, mime: "image/webp" }),
    ]);
    expect(result.bytes.get(photo.id)?.byteLength).toBeGreaterThan(1000);
  });
});
