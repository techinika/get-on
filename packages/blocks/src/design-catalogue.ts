import { FONT_PAIRS, PALETTES } from './theme';
import type {
  DisplayScale,
  EyebrowStyle,
  FooterLayout,
  HeaderStyle,
  HeadingCase,
  HeadingTracking,
  ImageStyle,
  LinkStyle,
  Rhythm,
  RuleStyle,
} from './types';

export type CatalogueItem = {
  id: string;
  label: string;
  description: string;
  whenToUse: string;
  avoidWhen: string;
  synonyms: string[];
};

export type BlockVariantItem = CatalogueItem & { block: string };

const item = (
  id: string,
  label: string,
  description: string,
  whenToUse: string,
  avoidWhen: string,
  synonyms: string[] = [],
): CatalogueItem => ({ id, label, description, whenToUse, avoidWhen, synonyms });

export const HERO_LAYOUTS: CatalogueItem[] = [
  item('split', 'Split', 'Text and a picture side by side.', 'Most businesses with one strong photo.', 'When the photo is weak or text-heavy.', ['split screen', 'half and half', 'image on one side', 'side by side']),
  item('centered', 'Centred', 'Centred words with an optional wide picture below.', 'A calm, confident first impression.', 'When the page needs to feel editorial.', ['middle', 'centred text', 'simple hero']),
  item('fullbleed', 'Full photo', 'A large background photo with text over it.', 'Restaurants, venues and visual businesses.', 'When the photo is busy behind text.', ['full screen photo', 'background image', 'photo hero']),
  item('editorial', 'Editorial', 'A magazine-style rule, huge heading and wide image strip.', 'Studios, portfolios and bold brands.', 'When the business needs a gentle, traditional feel.', ['magazine', 'big type', 'poster', 'newspaper']),
  item('card-over-image', 'Card over photo', 'A text card sitting over a full-width photo.', 'Shops and venues with a strong lifestyle photo.', 'When there is no suitable photo.', ['text box over photo', 'card on image', 'overlay card']),
  item('minimal', 'Minimal', 'Text only, with an accent rule and generous space.', 'Developers, consultants and text-led brands.', 'When visitors need to see the product immediately.', ['plain', 'text only', 'simple', 'no image']),
  item('offset-frame', 'Offset frame', 'A portrait photo with a coloured frame and optional badge.', 'Salons, makers and personal services.', 'When the brand should feel strictly corporate.', ['framed image', 'offset', 'badge', 'portrait']),
  item('diagonal', 'Diagonal', 'A slanted colour panel beside a photo.', 'Trades and services that need energy.', 'When the brand is quiet or luxurious.', ['slanted', 'angled', 'diagonal split']),
  item('product-shot', 'Product shot', 'A browser-style frame showing a product image.', 'Software and digital products.', 'When there is no product image.', ['app mockup', 'dashboard screenshot', 'browser window', 'product screenshot']),
  item('arch', 'Arch', 'A tall arched photo beside the text.', 'Law firms, salons and trusted services.', 'When the brand is playful or technical.', ['arched image', 'rounded top', 'archway']),
];

export const HEADER_STYLES: CatalogueItem[] = [
  item('classic', 'Classic', 'Name left, menu right.', 'Almost any website.', 'When the brand needs a distinctive header.', ['normal', 'standard', 'left logo']),
  item('centered', 'Centred', 'Name and menu centred on two rows.', 'Law firms, salons and traditional brands.', 'When space is tight on mobile.', ['middle', 'centred logo']),
  item('overlay', 'Overlay', 'A transparent header over the first photo.', 'Restaurants and visual businesses.', 'When the first section is not a photo.', ['transparent', 'over photo']),
  item('split', 'Split', 'Menu left, name centre, actions right.', 'Shops and balanced brands.', 'When the menu is very long.', ['three part', 'menu left']),
  item('minimal', 'Minimal', 'Name and a Menu button only.', 'Portfolios and focused personal sites.', 'When visitors need to see every page at once.', ['simple', 'text menu', 'no nav']),
];

export const FOOTER_LAYOUTS: CatalogueItem[] = [
  item('simple', 'Simple', 'Name, contact details and a short menu.', 'Small sites with few pages.', 'When there is a lot of secondary information.', ['basic', 'small']),
  item('columns', 'Columns', 'About text and several link columns.', 'Businesses with more pages and resources.', 'When the footer would become crowded on mobile.', ['multi column', 'links']),
  item('centered', 'Centred', 'A calm centred footer.', 'Restaurants, salons and personal brands.', 'When many links must be visible.', ['middle', 'simple centred']),
  item('bigbrand', 'Big brand', 'A giant typographic name above the legal row.', 'Shops and creative studios.', 'When the business name is very long.', ['huge name', 'wordmark', 'editorial']),
];

export const BLOCK_VARIANTS: BlockVariantItem[] = [
  { block: 'features', id: 'bento', label: 'Bento', description: 'Mixed-size feature tiles.', whenToUse: 'A few features of different importance.', avoidWhen: 'All items are equally important.', synonyms: ['mosaic', 'tiles', 'mixed grid'] },
  { block: 'features', id: 'rows', label: 'Rows', description: 'Wide numbered rows.', whenToUse: 'Explaining a service in depth.', avoidWhen: 'There are many short items.', synonyms: ['list', 'numbered rows'] },
  { block: 'features', id: 'tiles', label: 'Colour tiles', description: 'Square coloured tiles.', whenToUse: 'A playful, visual summary.', avoidWhen: 'The brand is very traditional.', synonyms: ['blocks', 'squares', 'colour tiles'] },
  { block: 'services', id: 'cards-image', label: 'Picture cards', description: 'Service cards with pictures and prices.', whenToUse: 'Services that are easier to show than describe.', avoidWhen: 'There are no suitable pictures.', synonyms: ['photo cards', 'service pictures'] },
  { block: 'services', id: 'columns-rules', label: 'Ruled columns', description: 'Three columns divided by fine rules.', whenToUse: 'A calm professional service list.', avoidWhen: 'There are more than six services.', synonyms: ['columns', 'lines', 'price list'] },
  { block: 'gallery', id: 'mosaic', label: 'Mosaic', description: 'Mixed-size photo grid.', whenToUse: 'Showing a rich set of photos.', avoidWhen: 'There are fewer than four photos.', synonyms: ['collage', 'mixed grid'] },
  { block: 'gallery', id: 'filmstrip', label: 'Filmstrip', description: 'A horizontal scrolling strip.', whenToUse: 'A long visual story.', avoidWhen: 'Every photo must be visible at once.', synonyms: ['carousel', 'strip', 'slider'] },
  { block: 'testimonials', id: 'wall', label: 'Wall', description: 'A masonry wall of quotes.', whenToUse: 'Many short testimonials.', avoidWhen: 'There is only one quote.', synonyms: ['masonry', 'quotes wall'] },
  { block: 'testimonials', id: 'spotlight', label: 'Spotlight', description: 'One large quote with a portrait.', whenToUse: 'A single powerful testimonial.', avoidWhen: 'The quote is short and generic.', synonyms: ['big quote', 'featured quote'] },
  { block: 'image-text', id: 'overlap', label: 'Overlap', description: 'A text card overlapping the picture.', whenToUse: 'A story with a strong image.', avoidWhen: 'The picture has important detail at the edge.', synonyms: ['overlapping card', 'offset card'] },
  { block: 'image-text', id: 'fullbleed-split', label: 'Full split', description: 'Edge-to-edge picture and text halves.', whenToUse: 'A bold, immersive story.', avoidWhen: 'The page needs a narrow reading column.', synonyms: ['half and half', 'edge to edge'] },
  { block: 'stats', id: 'big-rules', label: 'Big rules', description: 'Large numbers divided by rules.', whenToUse: 'A few impressive numbers.', avoidWhen: 'The numbers are not verified.', synonyms: ['numbers', 'figures'] },
  { block: 'cta', id: 'split', label: 'Split panel', description: 'A coloured panel with text and buttons.', whenToUse: 'A strong closing action.', avoidWhen: 'The page already has many buttons.', synonyms: ['panel', 'box'] },
  { block: 'cta', id: 'ribbon', label: 'Ribbon', description: 'A thin full-width action bar.', whenToUse: 'A light final nudge.', avoidWhen: 'The action needs a long explanation.', synonyms: ['bar', 'strip'] },
  { block: 'products', id: 'lookbook', label: 'Lookbook', description: 'Large staggered product pictures.', whenToUse: 'A small, curated collection.', avoidWhen: 'There are many products.', synonyms: ['editorial shop', 'gallery shop'] },
  { block: 'products', id: 'catalog', label: 'Catalogue', description: 'A dense product grid.', whenToUse: 'A larger product range.', avoidWhen: 'There are fewer than six products.', synonyms: ['grid', 'shop grid'] },
  { block: 'projects', id: 'list', label: 'List', description: 'Wide project rows with optional thumbnails.', whenToUse: 'Case studies and portfolios.', avoidWhen: 'The projects need equal visual weight.', synonyms: ['rows', 'case list'] },
  { block: 'steps', id: 'big-numbers', label: 'Big numbers', description: 'Oversized outlined step numbers.', whenToUse: 'A short, clear process.', avoidWhen: 'There are more than six steps.', synonyms: ['process', 'numbered'] },
  { block: 'team', id: 'offset', label: 'Offset team', description: 'Portraits staggered down the page.', whenToUse: 'A small team with strong portraits.', avoidWhen: 'There are many team members.', synonyms: ['staggered', 'portraits'] },
  { block: 'menu', id: 'board', label: 'Menu board', description: 'A dark board with dotted price leaders.', whenToUse: 'Restaurants and cafes.', avoidWhen: 'The menu is very long or changes daily.', synonyms: ['chalkboard', 'price list'] },
];

export const DESIGN_OPTIONS = {
  headingCase: [
    item('normal', 'Normal case', 'Headings keep their natural case.', 'Most websites.', 'When the brand needs a bolder voice.', ['sentence case', 'normal']),
    item('upper', 'Uppercase', 'Headings are shown in capitals.', 'Bold trades and creative brands.', 'When headings are long.', ['capitals', 'all caps']),
  ] satisfies CatalogueItem[],
  headingTracking: [
    item('tight', 'Tight', 'Headings sit close together.', 'Large display headings.', 'When the font is already narrow.', ['close', 'compact']),
    item('normal', 'Normal', 'The default heading spacing.', 'Most websites.', 'When the brand needs a distinctive voice.', ['standard']),
    item('wide', 'Wide', 'Headings are spaced out.', 'Small caps and elegant brands.', 'When headings are long.', ['spaced', 'airy']),
  ] satisfies CatalogueItem[],
  display: [
    item('normal', 'Normal', 'Headings use the standard hero size.', 'Most websites.', 'When the hero should feel like a poster.', ['standard']),
    item('dramatic', 'Dramatic', 'A much larger hero heading.', 'Bold, editorial brands.', 'When the heading is long.', ['huge', 'poster', 'big type']),
  ] satisfies CatalogueItem[],
  rhythm: [
    item('even', 'Even', 'Every section has the same background.', 'Calm, simple sites.', 'When the page feels long.', ['plain', 'same']),
    item('alternate', 'Alternate', 'Every second section is softly tinted.', 'Long pages that need rhythm.', 'When the palette is very strong.', ['stripes', 'alternating']),
    item('tinted', 'Tinted', 'Soft, plain and softly tinted sections.', 'Warm, gentle brands.', 'When the page is very short.', ['soft', 'gentle']),
    item('bold', 'Bold', 'Occasional strong colour sections.', 'Energetic brands.', 'When there are many photos.', ['strong', 'contrast']),
  ] satisfies CatalogueItem[],
  imageStyle: [
    item('rounded', 'Rounded', 'Softly rounded pictures.', 'Most businesses.', 'When the brand is strictly editorial.', ['soft corners', 'rounded']),
    item('sharp', 'Sharp', 'Square picture corners.', 'Editorial and technical brands.', 'When the brand is soft and friendly.', ['square', 'straight']),
    item('arch', 'Arch', 'Tall arched pictures.', 'Salons, law firms and boutiques.', 'When pictures are wide landscapes.', ['arched', 'rounded top']),
    item('offset', 'Offset frame', 'A coloured frame behind the picture.', 'Makers and personal brands.', 'When the page is busy.', ['framed', 'offset']),
    item('circle', 'Circle', 'Circular pictures for people.', 'Team and avatar pictures.', 'For landscape or product pictures.', ['round', 'avatar']),
  ] satisfies CatalogueItem[],
  eyebrowStyle: [
    item('chip', 'Chip', 'A small pill-shaped label.', 'Modern businesses.', 'When the brand is very traditional.', ['pill', 'badge']),
    item('caps', 'Small caps', 'Plain uppercase small text.', 'Professional brands.', 'When the brand is playful.', ['uppercase', 'small caps']),
    item('line', 'Line', 'Small caps with a short accent bar.', 'Elegant and editorial brands.', 'When space is tight.', ['bar', 'rule']),
    item('none', 'None', 'No eyebrow label.', 'Minimal brands.', 'When the section needs context.', ['hidden', 'plain']),
  ] satisfies CatalogueItem[],
  linkStyle: [
    item('underline', 'Underline', 'Links are underlined.', 'The safest, clearest choice.', 'When the design is very editorial.', ['line', 'classic']),
    item('arrow', 'Arrow', 'Links show a small arrow.', 'Modern service websites.', 'When there are many inline links.', ['chevron', 'arrow']),
    item('plain', 'Plain', 'Links rely on colour alone.', 'Minimal brands.', 'When contrast or clarity is weak.', ['simple', 'no underline']),
  ] satisfies CatalogueItem[],
  rules: [
    item('none', 'None', 'No divider rules.', 'Calm, minimal sites.', 'When sections need separation.', ['plain']),
    item('hairline', 'Hairline', 'Fine divider rules.', 'Professional and editorial brands.', 'When the page is very busy.', ['thin', 'line']),
    item('bold', 'Bold', 'Strong divider rules.', 'Bold creative brands.', 'When the page is already heavy.', ['thick', 'strong']),
  ] satisfies CatalogueItem[],
  shapes: [
    item('none', 'None', 'A straight section edge.', 'Most sections.', 'When the page needs movement.', ['straight']),
    item('slant', 'Slant', 'A diagonal cut edge.', 'Energetic service brands.', 'When the section contains important content near the edge.', ['diagonal', 'angle']),
    item('curve', 'Curve', 'A soft curved edge.', 'Warm and friendly brands.', 'When sections are very short.', ['round', 'arc']),
    item('wave', 'Wave', 'A gentle wave edge.', 'Restaurants and community brands.', 'When the page is very formal.', ['sine', 'wave']),
  ] satisfies CatalogueItem[],
  patterns: [
    item('none', 'None', 'A plain background.', 'Most sections.', 'When the section feels empty.', ['plain']),
    item('dots', 'Dots', 'A subtle dot pattern.', 'Playful and friendly brands.', 'Behind long text.', ['polka', 'dots']),
    item('grid', 'Grid', 'A faint grid pattern.', 'Technical and developer brands.', 'Behind busy pictures.', ['lines', 'graph']),
    item('lines', 'Diagonal lines', 'Faint diagonal lines.', 'Creative and editorial brands.', 'Behind small text.', ['stripes', 'diagonal']),
    item('noise', 'Grain', 'A fine paper-like texture.', 'Warm and crafted brands.', 'Behind very small text.', ['grain', 'texture']),
  ] satisfies CatalogueItem[],
  density: [
    item('compact', 'Compact', 'Less space between sections.', 'Trades and information-rich sites.', 'When the page should feel calm.', ['tight', 'small']),
    item('comfortable', 'Comfortable', 'The default spacing.', 'Most websites.', 'When the brand is very luxurious.', ['normal']),
    item('airy', 'Airy', 'Generous space between sections.', 'Luxury, legal and editorial brands.', 'When the page is very long.', ['spacious', 'large']),
  ] satisfies CatalogueItem[],
  corners: [
    item('sharp', 'Sharp', 'Square corners.', 'Editorial and technical brands.', 'When the brand is soft.', ['square', 'straight']),
    item('soft', 'Soft', 'Softly rounded corners.', 'Most businesses.', 'When the brand is strictly editorial.', ['rounded', 'normal']),
    item('round', 'Round', 'Very rounded corners.', 'Friendly and playful brands.', 'When the brand is formal.', ['pill', 'curved']),
  ] satisfies CatalogueItem[],
  buttons: [
    item('square', 'Square', 'Square buttons.', 'Bold trades and editorial brands.', 'When the brand is soft.', ['straight']),
    item('soft', 'Soft', 'Softly rounded buttons.', 'Most businesses.', 'When the brand is strictly square.', ['rounded']),
    item('round', 'Round', 'Very rounded buttons.', 'Friendly brands.', 'When the brand is formal.', ['curved']),
    item('pill', 'Pill', 'Fully rounded buttons.', 'Playful and beauty brands.', 'When the brand is technical.', ['capsule', 'rounded']),
  ] satisfies CatalogueItem[],
  displayScale: [
    item('normal', 'Normal', 'Standard hero heading size.', 'Most websites.', 'When the hero should be a poster.', ['standard']),
    item('dramatic', 'Dramatic', 'Large poster-like hero heading.', 'Creative and editorial brands.', 'When the heading is long.', ['huge', 'poster']),
  ] satisfies CatalogueItem[],
};

export const FONT_CATALOGUE = Object.entries(FONT_PAIRS).map(([id, pair]) =>
  item(id, pair.name, `${pair.heading} headings with ${pair.body} body text.`, 'Match the font to the brand voice.', 'When the fonts are not available.', [pair.heading.toLowerCase(), pair.body.toLowerCase()]),
);

export const PALETTE_CATALOGUE = Object.entries(PALETTES).map(([id, palette]) =>
  item(id, palette.name, `${palette.group} colours with a ${palette.primary} primary.`, 'Match the palette to the business type and mood.', 'When contrast fails.', [palette.group.toLowerCase(), palette.primary.toLowerCase()]),
);

export const ARCHETYPES: CatalogueItem[] = [
  item('starter', 'Starter', 'A flexible family of small business designs.', 'New websites with little information.', 'When the business needs a very specific look.', ['default', 'small business']),
  item('software-company', 'Software company', 'A modern product-led SaaS website.', 'Software products and apps.', 'When there is no product to show.', ['saas', 'app', 'startup']),
  item('law-firm', 'Law firm', 'A calm, traditional professional website.', 'Lawyers, accountants and consultants.', 'When the brand is playful.', ['legal', 'professional']),
  item('restaurant', 'Restaurant', 'A warm, appetising food website.', 'Restaurants, cafes and food businesses.', 'When the business does not serve food.', ['cafe', 'food', 'menu']),
  item('developer-portfolio', 'Developer portfolio', 'A dark, technical personal website.', 'Developers and technical freelancers.', 'When the brand should feel warm and traditional.', ['developer', 'portfolio', 'technical']),
  item('salon-beauty', 'Salon and beauty', 'A soft, elegant beauty website.', 'Salons, spas and beauty therapists.', 'When the brand is strictly corporate.', ['beauty', 'spa', 'salon']),
  item('boutique-shop', 'Boutique shop', 'A product-first retail website.', 'Small shops and makers.', 'When there is no product photography.', ['shop', 'retail', 'store']),
  item('home-services', 'Home services', 'A bold, trustworthy trades website.', 'Repair, building and home service businesses.', 'When the brand is quiet and luxurious.', ['trades', 'repair', 'contractor']),
  item('community-church', 'Community and church', 'A warm, welcoming community website.', 'Churches, charities and community groups.', 'When the group is strictly corporate.', ['church', 'charity', 'community']),
  item('creative-studio', 'Creative studio', 'An editorial, high-contrast studio website.', 'Designers, studios and creatives.', 'When the brand is traditional.', ['studio', 'creative', 'agency']),
];

export const DESIGN_CATALOGUE = {
  heroLayouts: HERO_LAYOUTS,
  headerStyles: HEADER_STYLES,
  footerLayouts: FOOTER_LAYOUTS,
  blockVariants: BLOCK_VARIANTS,
  designOptions: DESIGN_OPTIONS,
  fonts: FONT_CATALOGUE,
  palettes: PALETTE_CATALOGUE,
  archetypes: ARCHETYPES,
};

export function findCatalogueItem(list: CatalogueItem[], id: string): CatalogueItem | undefined {
  return list.find((entry) => entry.id === id);
}

export function synonymsFor(list: CatalogueItem[], id: string): string[] {
  return findCatalogueItem(list, id)?.synonyms ?? [];
}

export type { DisplayScale, EyebrowStyle, FooterLayout, HeaderStyle, HeadingCase, HeadingTracking, ImageStyle, LinkStyle, Rhythm, RuleStyle };
