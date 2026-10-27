import { ARCHETYPES } from "@get-on/blocks";
import { COLOUR_NAMES, MOOD_PALETTES, colourNameToHex } from "./colour-vocabulary";
import { FEEL_WORDS, findFontName } from "./fonts";
import {
  emptyDesignSpec,
  normaliseHex,
  requirement,
  type DesignSpec,
  type FeelId,
  type MoodId,
  type Requirement,
  type RequirementKind,
  type ToneId,
} from "./spec";

const MAX_TEXT = 600;

const HERO_WORDS: Record<string, string[]> = {
  split: ["split screen", "half and half", "image on one side", "side by side", "split hero"],
  centered: ["centred", "centered", "middle", "centred text", "text in the middle"],
  fullbleed: ["full screen photo", "full-screen photo", "background image", "big photo", "full photo", "photo hero"],
  editorial: ["magazine", "big type", "poster", "newspaper", "editorial"],
  "card-over-image": ["text box over photo", "card on image", "overlay card", "card over photo"],
  minimal: ["text only", "no image", "plain hero", "minimal hero", "simple hero"],
  "offset-frame": ["framed image", "offset frame", "portrait with frame", "badge"],
  diagonal: ["slanted", "angled", "diagonal split", "diagonal"],
  "product-shot": ["app mockup", "dashboard screenshot", "browser window", "product screenshot", "product shot"],
  arch: ["arched image", "rounded top", "archway", "arch hero"],
};

const HEADER_WORDS: Record<string, string[]> = {
  classic: ["classic header", "normal header", "standard header", "name on the left"],
  centered: ["centred header", "centered header", "centred logo", "logo in the middle"],
  overlay: ["transparent header", "header over photo", "overlay header"],
  split: ["split header", "menu on the left", "three part header"],
  minimal: ["minimal header", "simple header", "no navigation", "menu button only"],
};

const FOOTER_WORDS: Record<string, string[]> = {
  simple: ["simple footer", "small footer", "basic footer"],
  columns: ["column footer", "columns footer", "link columns", "multi column footer"],
  centered: ["centred footer", "centered footer", "middle footer"],
  bigbrand: ["big brand footer", "huge name", "giant wordmark", "big wordmark"],
};

const SECTION_WORDS: Record<string, string[]> = {
  pricing: ["pricing", "prices", "plans", "price list"],
  gallery: ["gallery", "photos", "image gallery", "picture gallery"],
  faq: ["faq", "faqs", "questions", "frequently asked"],
  team: ["team", "staff", "people", "meet the team"],
  testimonials: ["testimonials", "reviews", "quotes", "recommendations"],
  map: ["map", "location", "directions"],
  booking: ["booking", "book a table", "book now", "appointment"],
  menu: ["menu", "food menu", "drinks menu"],
  products: ["products", "shop", "store", "collection"],
  services: ["services", "what we do", "treatments"],
  contact: ["contact", "contact form", "get in touch"],
  stats: ["stats", "statistics", "numbers", "figures"],
  features: ["features", "benefits", "what we offer"],
  logos: ["logos", "partners", "clients"],
  steps: ["steps", "process", "how it works"],
  cta: ["call to action", "cta", "final button"],
  "before-after": ["before and after", "before after", "transformations"],
  "image-text": ["image and text", "photo and text", "story section"],
};

const PAGE_WORDS: Record<string, string[]> = {
  about: ["about", "about us", "our story"],
  contact: ["contact", "contact page", "get in touch"],
  services: ["services page", "our services"],
  pricing: ["pricing page", "prices page"],
  menu: ["menu page", "food menu page"],
  gallery: ["gallery page", "photos page"],
  faq: ["faq page", "questions page"],
  team: ["team page", "staff page", "attorneys page"],
  blog: ["blog", "journal", "news"],
  shop: ["shop page", "store page"],
  portfolio: ["portfolio page", "work page", "projects page"],
  events: ["events page", "schedule page"],
  visit: ["visit page", "visit us page"],
};

const TONE_WORDS: Record<ToneId, string[]> = {
  friendly: ["friendly", "welcoming", "approachable", "kind"],
  professional: ["professional", "trustworthy", "reliable", "businesslike", "formal"],
  bold: ["bold", "confident", "strong", "loud", "punchy"],
  calm: ["calm", "quiet", "serene", "relaxed", "peaceful"],
  playful: ["playful", "fun", "cheeky", "lighthearted", "energetic"],
  elegant: ["elegant", "refined", "sophisticated"],
  warm: ["warm", "cosy", "cozy", "homely", "comforting"],
  direct: ["direct", "clear", "straightforward", "no-nonsense", "simple words"],
  luxury: ["luxury", "high end", "exclusive", "premium", "upscale"],
  technical: ["technical", "precise", "developer", "engineering", "data"],
};

const UNSUPPORTED: Array<{ text: string; nearest: string; words: string[] }> = [
  { text: "animation", nearest: "Use a calm static design with gentle colour and spacing.", words: ["animation", "animated", "motion", "moving background"] },
  { text: "video background", nearest: "Use a full-width photo in the hero instead.", words: ["video background", "background video", "video hero"] },
  { text: "parallax", nearest: "Use a strong photo and generous spacing instead.", words: ["parallax", "scrolling effect"] },
  { text: "3D", nearest: "Use flat shapes and layered colour instead.", words: ["3d", "three dimensional", "3-d"] },
  { text: "custom code", nearest: "Pick from the supported layouts and sections.", words: ["custom code", "html", "javascript", "css code"] },
  { text: "third-party widget", nearest: "Use a built-in section and a simple link.", words: ["third party widget", "third-party widget", "embed", "iframe"] },
  { text: "sticky side menu", nearest: "Use the minimal header with a full-screen menu.", words: ["sticky side menu", "sidebar menu", "side navigation"] },
];

const LANGUAGE_WORDS: Record<string, string[]> = {
  fr: ["bonjour", "couleur", "couleurs", "police", "moderne", "élégant", "chaleureux", "sombre", "clair", "page", "sections", "sans", "avec", "vert", "bleu", "rouge", "jaune", "noir", "blanc", "beige", "crème", "cozy", "chic", "minimaliste", "épuré", "grande", "photo", "menu", "équipe", "tarifs", "galerie", "contact", "avis", "carte", "réservation"],
  es: ["hola", "color", "colores", "fuente", "moderno", "elegante", "cálido", "oscuro", "claro", "página", "secciones", "sin", "con", "verde", "azul", "rojo", "amarillo", "negro", "blanco", "beige", "crema", "acogedor", "minimalista", "grande", "foto", "menú", "equipo", "precios", "galería", "contacto", "reseñas", "reserva", "mapa"],
  pt: ["olá", "cor", "cores", "fonte", "moderno", "elegante", "quente", "escuro", "claro", "página", "secções", "sem", "com", "verde", "azul", "vermelho", "amarelo", "preto", "branco", "bege", "creme", "aconchegante", "minimalista", "grande", "foto", "menu", "equipe", "preços", "galeria", "contato", "avaliações", "reserva", "mapa"],
  de: ["hallo", "farbe", "farben", "schrift", "modern", "elegant", "warm", "dunkel", "hell", "seite", "abschnitte", "ohne", "mit", "grün", "blau", "rot", "gelb", "schwarz", "weiß", "beige", "creme", "gemütlich", "minimalistisch", "groß", "foto", "menü", "team", "preise", "galerie", "kontakt", "bewertungen", "buchung", "karte"],
  it: ["ciao", "colore", "colori", "carattere", "moderno", "elegante", "caldo", "scuro", "chiaro", "pagina", "sezioni", "senza", "con", "verde", "blu", "rosso", "giallo", "nero", "bianco", "beige", "crema", "accogliente", "minimalista", "grande", "foto", "menu", "squadra", "prezzi", "galleria", "contatto", "recensioni", "prenotazione", "mappa"],
  sw: ["habari", "rangi", "fonti", "ya kisasa", "kifahari", "joto", "nyeusi", "nyeupe", "ukurasa", "sehemu", "bila", "na", "kijani", "bluu", "nyekundu", "njano", "beige", "cream", "minimalist", "kubwa", "picha", "menyu", "timu", "bei", "matunzio", "mawasiliano", "huduma", "nafasi"],
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegex(word)}\\b`, "i").test(text);
}

function firstMatch(text: string, words: string[]): { word: string; index: number } | null {
  let best: { word: string; index: number } | null = null;
  for (const word of words) {
    const match = new RegExp(`\\b${escapeRegex(word)}\\b`, "i").exec(text);
    if (match && (!best || match.index < best.index)) best = { word, index: match.index };
  }
  return best;
}

function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index).toLowerCase();
  const tail = before.split(/[,;]|\b(?:and|but)\b/).pop() ?? before;
  return /\b(no|not|without|avoid|remove|exclude|don't|dont|never)\b[^.!?]{0,24}$/.test(tail);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const section = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r1, g1, b1] =
    section < 1 ? [chroma, x, 0] :
    section < 2 ? [x, chroma, 0] :
    section < 3 ? [0, chroma, x] :
    section < 4 ? [0, x, chroma] :
    section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = light - chroma / 2;
  const hexPart = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${hexPart(r1)}${hexPart(g1)}${hexPart(b1)}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function luminance(hex: string): number {
  const value = normaliseHex(hex);
  if (!value) return 1;
  const channel = (offset: number) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

type ColourHit = { hex: string; index: number; label: string };

function colourHits(text: string): ColourHit[] {
  const hits: ColourHit[] = [];
  const patterns: Array<{ re: RegExp; convert: (match: RegExpExecArray) => string | null }> = [
    { re: /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi, convert: (match) => normaliseHex(match[0]) },
    { re: /\brgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)/gi, convert: (match) => rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])) },
    { re: /\brgba\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*[\d.]+\s*\)/gi, convert: (match) => rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])) },
    { re: /\bhsl\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})%\s*[, ]\s*(\d{1,3})%\s*\)/gi, convert: (match) => hslToHex(Number(match[1]), Number(match[2]), Number(match[3])) },
  ];
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.re.exec(text))) {
      const hex = pattern.convert(match);
      if (hex) hits.push({ hex, index: match.index, label: match[0] });
    }
  }
  const names = Object.keys(COLOUR_NAMES).sort((a, b) => b.length - a.length);
  const nameRegex = new RegExp(`\\b(${names.map(escapeRegex).join("|")})\\b`, "gi");
  let match: RegExpExecArray | null;
  while ((match = nameRegex.exec(text))) {
    const hex = colourNameToHex(match[1]!);
    if (hex) hits.push({ hex, index: match.index, label: match[1]! });
  }
  const seen = new Set<string>();
  return hits
    .sort((a, b) => a.index - b.index)
    .filter((hit) => {
      const key = `${hit.index}:${hit.hex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function roleNear(text: string, index: number, previousIndex = 0): "primary" | "accent" | "background" | "text" | "soft" | null {
  const start = Math.max(previousIndex, index - 40);
  const fullBefore = text.slice(start, index).toLowerCase();
  const before = fullBefore.split(/[,;]|\b(?:and|but|with)\b/).pop() ?? fullBefore;
  const after = text.slice(index, index + 48).toLowerCase();
  const rules: Array<[RegExp, "primary" | "accent" | "background" | "text" | "soft"]> = [
    [/\b(background|backdrop|page|canvas|base)\b/, "background"],
    [/\b(text|body copy|copy|font colour|font color)\b/, "text"],
    [/\b(accent|secondary|highlight|highlight colour|highlight color)\b/, "accent"],
    [/\b(soft|section|sections|card|cards|tint)\b/, "soft"],
    [/\b(primary|main|brand|buttons?|link|links)\b/, "primary"],
  ];
  let best: { role: "primary" | "accent" | "background" | "text" | "soft"; index: number } | null = null;
  for (const [pattern, role] of rules) {
    const match = pattern.exec(before);
    if (match && (!best || match.index > best.index)) best = { role, index: match.index };
  }
  if (best) return best.role;
  if (/\b(as the|for the)\s+(background|page)\b/.test(after)) return "background";
  return null;
}

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  let best = { language: "en", score: 0 };
  for (const [language, words] of Object.entries(LANGUAGE_WORDS)) {
    const score = words.reduce((total, word) => total + (containsWord(lower, word) ? 1 : 0), 0);
    if (score > best.score) best = { language, score };
  }
  return best.score >= 2 ? best.language : "en";
}

function detectMood(text: string): MoodId | undefined {
  const lower = text.toLowerCase();
  const moods: Array<[MoodId, string[]]> = [
    ["warm", ["warm", "cosy", "cozy", "sunny", "golden"]],
    ["cool", ["cool", "icy", "blue toned", "blue-toned"]],
    ["earthy", ["earthy", "earth tone", "earth tones", "natural", "organic"]],
    ["pastel", ["pastel", "soft colours", "soft colors", "pale"]],
    ["vibrant", ["vibrant", "colourful", "colorful", "bright"]],
    ["muted", ["muted", "desaturated", "subtle"]],
    ["neon", ["neon", "electric", "fluorescent"]],
    ["luxury", ["luxury", "luxurious", "high end", "high-end", "premium"]],
    ["fresh", ["fresh", "clean", "crisp"]],
    ["natural", ["natural", "botanical", "plant"]],
    ["playful", ["playful", "fun", "cheerful"]],
    ["corporate", ["corporate", "professional", "business"]],
  ];
  for (const [mood, words] of moods) if (words.some((word) => containsWord(lower, word))) return mood;
  return undefined;
}

function findArchetype(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const archetype of ARCHETYPES) {
    if (containsWord(lower, archetype.id) || containsWord(lower, archetype.label.toLowerCase())) return archetype.id;
    if (archetype.synonyms.some((word) => containsWord(lower, word))) return archetype.id;
  }
  if (containsWord(lower, "saas") || containsWord(lower, "software")) return "software-company";
  if (containsWord(lower, "lawyer") || containsWord(lower, "legal")) return "law-firm";
  if (containsWord(lower, "cafe") || containsWord(lower, "food")) return "restaurant";
  if (containsWord(lower, "spa") || containsWord(lower, "beauty")) return "salon-beauty";
  if (containsWord(lower, "shop") || containsWord(lower, "retail")) return "boutique-shop";
  if (containsWord(lower, "trades") || containsWord(lower, "repair")) return "home-services";
  if (containsWord(lower, "church") || containsWord(lower, "charity")) return "community-church";
  if (containsWord(lower, "studio") || containsWord(lower, "agency")) return "creative-studio";
  if (containsWord(lower, "developer") || containsWord(lower, "portfolio")) return "developer-portfolio";
  return undefined;
}

function bestCatalogueMatch(text: string, map: Record<string, string[]>): string | null {
  let best: { id: string; index: number } | null = null;
  for (const [id, words] of Object.entries(map)) {
    const match = firstMatch(text, words);
    if (match && !isNegated(text, match.index) && (!best || match.index < best.index)) {
      best = { id, index: match.index };
    }
  }
  return best?.id ?? null;
}

function sectionOrder(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: Array<{ id: string; index: number }> = [];
  for (const [id, words] of Object.entries(SECTION_WORDS)) {
    const match = firstMatch(lower, words);
    if (match) matches.push({ id, index: match.index });
  }
  return matches.sort((a, b) => a.index - b.index).map((match) => match.id);
}

export function parseDesign(rawInput: string): DesignSpec {
  const rawText = rawInput.trim().slice(0, MAX_TEXT);
  const spec = emptyDesignSpec(rawText);
  const text = rawText.toLowerCase();
  spec.language = detectLanguage(rawText);

  const add = (item: Omit<Requirement, "id"> & { id?: string }) => {
    if (spec.requirements.length >= 40) return;
    const next = requirement(item);
    if (!spec.requirements.some((entry) => entry.id === next.id)) spec.requirements.push(next);
  };

  const hits = colourHits(text);
  const assigned = new Set<string>();
  let previousColourIndex = 0;
  for (const hit of hits) {
    const role = roleNear(text, hit.index, previousColourIndex);
    previousColourIndex = hit.index;
    if (isNegated(text, hit.index)) {
      spec.palette.avoid = [...(spec.palette.avoid ?? []), hit.label];
      continue;
    }
    if (!spec.palette.userHex.includes(hit.hex)) spec.palette.userHex.push(hit.hex);
    const target = role ?? (assigned.has("primary") ? "accent" : "primary");
    if (assigned.has(target)) continue;
    assigned.add(target);
    spec.palette[target] = hit.hex;
    add({ kind: "color_exact", target, value: hit.hex, strength: "must", source: "user" });
  }

  const dark = /\b(dark mode|dark theme|dark background|black background|mostly dark)\b/.test(text);
  const light = /\b(light mode|light theme|light background|white background|mostly light)\b/.test(text);
  if (dark) spec.palette.mode = "dark";
  else if (light) spec.palette.mode = "light";
  else if (spec.palette.background && luminance(spec.palette.background) < 0.2) spec.palette.mode = "dark";
  if (dark || light) {
    add({ kind: "mode", target: "palette", value: spec.palette.mode, strength: "must", source: "user" });
  }

  const monochrome = /\b(black and white|black & white|monochrome|greyscale|grayscale)\b/.test(text);
  if (monochrome) {
    spec.palette = {
      ...spec.palette,
      primary: "#111111",
      accent: "#666666",
      background: "#FFFFFF",
      text: "#111111",
      soft: "#F2F2F2",
      userHex: ["#111111", "#666666", "#FFFFFF", "#F2F2F2"],
    };
    add({ kind: "color_family", target: "palette", value: "neutral", strength: "must", source: "user" });
  }

  const mood = detectMood(text);
  if (mood) {
    spec.palette.mood = mood;
    if (!spec.palette.primary) {
      const generated = MOOD_PALETTES[mood];
      spec.palette.primary = generated.primary;
      spec.palette.accent = generated.accent;
      spec.palette.background = generated.background;
      spec.palette.text = generated.text;
      spec.palette.soft = generated.soft;
    }
  }

  const font = findFontName(rawText);
  if (font) {
    const before = text.slice(Math.max(0, font.index - 36), font.index);
    const body = /\b(body|paragraph|copy|reading)\b/.test(before);
    if (body) {
      spec.fonts.body = { id: font.id };
      add({ kind: "font_exact", target: "body", value: font.id, strength: "must", source: "user" });
    } else {
      spec.fonts.heading = { id: font.id };
      add({ kind: "font_exact", target: "heading", value: font.id, strength: "must", source: "user" });
    }
  }

  let feel: FeelId | undefined;
  for (const [id, words] of Object.entries(FEEL_WORDS) as Array<[FeelId, string[]]>) {
    if (words.some((word) => containsWord(text, word))) {
      feel = id;
      break;
    }
  }
  if (feel) {
    spec.fonts.feel = feel;
    add({ kind: "font_feel", target: "fonts", value: feel, strength: "should", source: "user" });
  }

  const hero = bestCatalogueMatch(text, HERO_WORDS);
  if (hero) {
    spec.layout.hero = hero;
    add({ kind: "hero_layout", target: "home", value: hero, strength: "must", source: "user" });
  }
  const header = bestCatalogueMatch(text, HEADER_WORDS);
  if (header) {
    spec.layout.header = header;
    add({ kind: "header_style", target: "site", value: header, strength: "must", source: "user" });
  }
  const footer = bestCatalogueMatch(text, FOOTER_WORDS);
  if (footer) {
    spec.layout.footer = footer;
    add({ kind: "footer_layout", target: "site", value: footer, strength: "must", source: "user" });
  }

  if (/\b(spacious|airy|lots of white space|plenty of space|open)\b/.test(text)) {
    spec.layout.density = "airy";
    add({ kind: "density", target: "theme", value: "airy", strength: "should", source: "user" });
  } else if (/\b(compact|dense|tight|small spacing)\b/.test(text)) {
    spec.layout.density = "compact";
    add({ kind: "density", target: "theme", value: "compact", strength: "should", source: "user" });
  } else if (/\b(comfortable|balanced spacing)\b/.test(text)) {
    spec.layout.density = "comfortable";
    add({ kind: "density", target: "theme", value: "comfortable", strength: "should", source: "user" });
  }

  if (/\b(sharp|square|angular)\b/.test(text)) {
    spec.layout.corners = "sharp";
    spec.layout.buttonShape = "square";
    spec.layout.imageStyle = "sharp";
    add({ kind: "corners", target: "theme", value: "sharp", strength: "should", source: "user" });
    add({ kind: "button_shape", target: "theme", value: "square", strength: "should", source: "user" });
    add({ kind: "image_style", target: "theme", value: "sharp", strength: "should", source: "user" });
  } else if (/\b(pill buttons|pill shaped|pill-shaped|capsule)\b/.test(text)) {
    spec.layout.buttonShape = "pill";
    add({ kind: "button_shape", target: "theme", value: "pill", strength: "should", source: "user" });
  } else if (/\b(rounded|round corners|soft corners)\b/.test(text)) {
    spec.layout.corners = "round";
    add({ kind: "corners", target: "theme", value: "round", strength: "should", source: "user" });
  }

  if (/\b(outline buttons|outlined buttons|ghost buttons)\b/.test(text)) {
    spec.layout.buttonStyle = "outline";
    add({ kind: "button_style", target: "theme", value: "outline", strength: "should", source: "user" });
  } else if (/\b(solid buttons|filled buttons)\b/.test(text)) {
    spec.layout.buttonStyle = "solid";
    add({ kind: "button_style", target: "theme", value: "solid", strength: "should", source: "user" });
  }

  if (/\b(arched images|arched photos|arch photos|arch images)\b/.test(text)) {
    spec.layout.imageStyle = "arch";
    add({ kind: "image_style", target: "theme", value: "arch", strength: "should", source: "user" });
  } else if (/\b(circular photos|circle photos|round photos|avatars)\b/.test(text)) {
    spec.layout.imageStyle = "circle";
    add({ kind: "image_style", target: "theme", value: "circle", strength: "should", source: "user" });
  } else if (/\b(no images|without images|text only)\b/.test(text)) {
    add({ kind: "image_style", target: "theme", value: "none", strength: "should", source: "user" });
  }

  if (/\b(left aligned|left-aligned|align left)\b/.test(text)) {
    spec.layout.align = "left";
    add({ kind: "alignment", target: "home", value: "left", strength: "should", source: "user" });
  } else if (/\b(centred|centered|align centre|align center)\b/.test(text)) {
    spec.layout.align = "center";
    add({ kind: "alignment", target: "home", value: "center", strength: "should", source: "user" });
  }

  for (const [id, words] of Object.entries(SECTION_WORDS)) {
    const match = firstMatch(text, words);
    if (!match) continue;
    if (isNegated(text, match.index)) {
      spec.sections.exclude.push(id);
      add({ kind: "section_excluded", target: "home", value: id, strength: "must", source: "user" });
    } else {
      spec.sections.include.push(id);
      add({ kind: "section_included", target: "home", value: id, strength: "should", source: "user" });
    }
  }

  for (const [id, words] of Object.entries(PAGE_WORDS)) {
    const match = firstMatch(text, words);
    if (!match) continue;
    if (isNegated(text, match.index)) {
      spec.pages.exclude.push(id);
      add({ kind: "page_excluded", target: "site", value: id, strength: "must", source: "user" });
    } else {
      spec.pages.include.push(id);
      add({ kind: "page_included", target: "site", value: id, strength: "should", source: "user" });
    }
  }

  const countMatch = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:-|\s)?page(?:s)?\b/i.exec(text);
  if (countMatch) {
    const rawCount = countMatch[1]!.toLowerCase();
    const count = WORD_NUMBERS[rawCount] ?? Number(rawCount);
    if (count >= 1 && count <= 30) {
      spec.pages.count = count;
      add({ kind: "page_count", target: "site", value: count, strength: "must", source: "user" });
    }
  }

  const order = sectionOrder(text);
  if (order.length > 1) spec.sections.order = order;

  for (const [id, words] of Object.entries(TONE_WORDS) as Array<[ToneId, string[]]>) {
    if (words.some((word) => containsWord(text, word)) && spec.tone.length < 3) {
      spec.tone.push(id);
      add({ kind: "tone", target: "copy", value: id, strength: "should", source: "user" });
    }
  }

  const mention = /\bmention(?:ing)?\s+(?:that\s+)?["“']([^"”']{2,80})["”']/i.exec(rawText);
  if (mention) {
    spec.copy.mention.push(mention[1]!.trim());
    add({ kind: "copy_mentions", target: "copy", value: mention[1]!.trim(), strength: "should", source: "user" });
  }
  const avoid = /\b(?:avoid|do not use|don't use)\s+(?:the\s+)?(?:(?:words?|phrases?)\s+)?["“']?([^"”'.,]{2,80})/i.exec(rawText);
  if (avoid) {
    spec.copy.avoidWords.push(avoid[1]!.trim());
    add({ kind: "copy_avoids", target: "copy", value: avoid[1]!.trim(), strength: "should", source: "user" });
  }

  for (const entry of UNSUPPORTED) {
    const match = firstMatch(text, entry.words);
    if (match) {
      spec.unsupported.push({ text: entry.text, nearest: entry.nearest });
    }
  }

  spec.archetype = findArchetype(text);

  if (dark && /\bpastel\b/.test(text)) {
    spec.conflicts.push({ a: "dark mode", b: "pastel colours", resolution: "Dark mode wins; pastel colours are used for accents only." });
  }
  if (spec.fonts.heading && spec.fonts.body && spec.fonts.heading.id === spec.fonts.body.id) {
    spec.conflicts.push({ a: "heading font", b: "body font", resolution: "The same family is used for both, as requested." });
  }

  if (spec.language !== "en") {
    add({ kind: "language", target: "copy", value: spec.language, strength: "must", source: "user" });
  }

  spec.confidence = spec.requirements.length === 0 ? 0.2 : Math.min(0.98, 0.55 + spec.requirements.length * 0.05);
  return spec;
}
