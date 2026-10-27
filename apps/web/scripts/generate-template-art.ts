import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { resolveThemeColors } from "@get-on/blocks";
import { SYSTEM_TEMPLATES, templateArtwork } from "@get-on/templates";

const docsDir = path.resolve(process.cwd(), "../../docs");
const outDir = path.join(docsDir, "template-art");

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const cards: string[] = [];

  for (const pkg of SYSTEM_TEMPLATES) {
    const theme = pkg.compositions[0]?.theme;
    if (!theme) continue;
    const slug = pkg.meta.slug;
    const palette = resolveThemeColors(theme);
    const artwork = templateArtwork(slug, palette);
    const dir = path.join(outDir, slug);
    await mkdir(dir, { recursive: true });

    for (const art of artwork) {
      const svgPath = path.join(dir, `${art.key}.svg`);
      const webpPath = path.join(dir, `${art.key}.webp`);
      await writeFile(svgPath, art.svg, "utf8");
      await sharp(Buffer.from(art.svg)).webp({ quality: 82 }).toFile(webpPath);
    }

    const [hero, section1, section2, portrait, logo] = artwork;
    cards.push(`
      <section class="template">
        <header><h2>${escape(pkg.meta.name)}</h2><p>${escape(slug)} · ${escape(pkg.meta.tagline)}</p></header>
        <div class="grid">
          <figure class="hero"><img src="template-art/${escape(slug)}/hero.webp" alt="${escape(hero!.alt)}" loading="lazy"><figcaption>Hero · ${hero!.recipe}</figcaption></figure>
          <figure><img src="template-art/${escape(slug)}/section-1.webp" alt="${escape(section1!.alt)}" loading="lazy"><figcaption>Section · ${section1!.recipe}</figcaption></figure>
          <figure><img src="template-art/${escape(slug)}/section-2.webp" alt="${escape(section2!.alt)}" loading="lazy"><figcaption>Section · ${section2!.recipe}</figcaption></figure>
          <figure><img src="template-art/${escape(slug)}/portrait.webp" alt="${escape(portrait!.alt)}" loading="lazy"><figcaption>Portrait · ${portrait!.recipe}</figcaption></figure>
          <figure class="logo"><img src="template-art/${escape(slug)}/logo.webp" alt="${escape(logo!.alt)}" loading="lazy"><figcaption>Logo · ${logo!.recipe}</figcaption></figure>
        </div>
      </section>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Template artwork preview</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 2rem; font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f6f3; color: #1f1a17; }
    h1 { font-size: 1.6rem; margin: 0 0 .4rem; }
    .intro { margin: 0 0 2rem; max-width: 60ch; color: #5b554e; }
    .template { margin: 0 0 3rem; }
    .template h2 { font-size: 1.15rem; margin: 0; }
    .template p { margin: .2rem 0 1rem; color: #6b645b; font-size: .9rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    figure { margin: 0; background: #fff; border: 1px solid #e5e0d8; border-radius: 12px; overflow: hidden; }
    figure.hero { grid-column: span 2; grid-row: span 2; }
    figure.logo { grid-column: span 2; }
    figure img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; }
    figure.hero img { aspect-ratio: 4 / 3; }
    figure.logo img { aspect-ratio: 3 / 1; object-fit: contain; background: #faf9f6; }
    figcaption { padding: .55rem .7rem; font-size: .75rem; color: #6b645b; border-top: 1px solid #eee9e1; }
    @media (max-width: 760px) { body { padding: 1rem; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } figure.hero, figure.logo { grid-column: span 2; } }
  </style>
</head>
<body>
  <h1>Template artwork preview</h1>
  <p class="intro">Generated from the shared art recipes. Every image is abstract, uses the template palette and contains no text. Run <code>pnpm --filter web art:templates</code> to rebuild.</p>
  ${cards.join("\n")}
</body>
</html>
`;
  await writeFile(path.join(docsDir, "template-art-preview.html"), html, "utf8");
  console.log(`Wrote ${SYSTEM_TEMPLATES.length} template artwork sets to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
