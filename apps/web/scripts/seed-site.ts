import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { buildSite } from "@get-on/publisher";
import {
  sharedPath,
  sitePath,
  writeNodePointer,
} from "@get-on/site-server/node";

const rootDir = path.resolve(
  process.env.LOCAL_SITES_DIR || path.join(process.cwd(), ".local-sites"),
);
const rootDomain = process.env.LOCAL_ROOT_DOMAIN || "localhost";
const subdomain = process.env.SEED_SUBDOMAIN || "rosebakery";
const siteId = "00000000-0000-4000-8000-000000000001";
const publishId = "00000000-0000-4000-8000-000000000002";

async function main() {
const result = await buildSite({
  siteId,
  publishId,
  subdomain,
  rootDomain,
  settings: {
    businessName: "Rose Bakery",
    theme: {
      palette: "fresh-green",
      fontPair: "friendly",
      corners: "round",
      colorMode: "light",
    },
    phone: "+44 20 7946 0958",
    email: "hello@rosebakery.test",
    address: "14 Market Street, London",
    seo: {
      title: "Rose Bakery — fresh bread every morning",
      description: "Bread, cakes and coffee baked fresh in the heart of London.",
      allowIndexing: false,
    },
    showWatermark: true,
    plan: "starter",
  },
  pages: [
    {
      id: "00000000-0000-4000-8000-000000000011",
      slug: "",
      title: "Home",
      showInMenu: false,
      blocks: [
        {
          id: "seed-hero-01",
          type: "hero",
          props: {
            heading: "Fresh bread, every morning",
            subheading:
              "Small-batch sourdough, pastries and coffee baked in our shop on Market Street.",
            buttonLabel: "See our menu",
            buttonLink: { type: "page", pageId: "00000000-0000-4000-8000-000000000012" },
            imageId: null,
            layout: "text-only",
            align: "center",
            background: "soft",
          },
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000012",
      slug: "menu",
      title: "Menu",
      blocks: [
        {
          id: "seed-head-01",
          type: "heading",
          props: {
            text: "Today at the bakery",
            level: "h2",
            align: "left",
            background: "plain",
          },
        },
      ],
    },
  ],
});

const versionDir = sitePath(rootDir, siteId, publishId);
await mkdir(versionDir, { recursive: true });
for (const [filePath, file] of Object.entries(result.files)) {
  const target = path.join(versionDir, filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.body);
}

for (const [filePath, file] of Object.entries(result.shared)) {
  const target = sharedPath(rootDir, filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.body);
}

await writeNodePointer(rootDir, `${subdomain}.${rootDomain}`, {
  siteId,
  publishId,
  state: "live",
  builtAt: new Date().toISOString(),
  plan: "starter",
});

console.log(
  `Seeded http://${subdomain}.${rootDomain}:${process.env.PUBLISH_PORT || 8787}`,
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
