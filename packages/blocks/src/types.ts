export type LinkTarget =
  | { type: 'none' }
  | { type: 'page', pageId: string }
  | { type: 'url', url: string }
  | { type: 'phone', number: string }
  | { type: 'email', address: string }
  | { type: 'whatsapp', number: string };

export type Background = 'plain' | 'soft' | 'brand';
export type Align = 'left' | 'center';
export type Corners = 'soft' | 'sharp' | 'round';
export type ColorMode = 'light' | 'dark' | 'auto';
export type FontPair = 'friendly' | 'classic' | 'modern' | 'warm';
export type Palette =
  | 'fresh-green'
  | 'ocean'
  | 'berry'
  | 'sunset'
  | 'midnight'
  | 'charcoal';

export type Theme = {
  palette: Palette;
  fontPair: FontPair;
  corners: Corners;
  colorMode?: ColorMode;
};

export type LinkContext = {
  getPageHref?: (pageId: string) => string;
};

export function linkToHref(link: LinkTarget | undefined | null, ctx: LinkContext = {}): string | null {
  if (!link) return null;
  if (link.type === 'none') return null;
  if (link.type === 'page') {
    if (ctx.getPageHref) return ctx.getPageHref(link.pageId);
    return `/pages/${link.pageId}`;
  }
  if (link.type === 'url') {
    try {
      const url = new URL(link.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return link.url;
    } catch {
      return null;
    }
  }
  if (link.type === 'phone') {
    const num = link.number.replace(/[^+\d]/g, '');
    if (!num) return null;
    return `tel:${num}`;
  }
  if (link.type === 'email') {
    if (!link.address) return null;
    return `mailto:${link.address}`;
  }
  if (link.type === 'whatsapp') {
    const num = link.number.replace(/\D/g, '');
    if (!num) return null;
    return `https://wa.me/${num}`;
  }
  return null;
}

export const ICON_NAMES = [
  'star',
  'heart',
  'clock',
  'map-pin',
  'phone',
  'mail',
  'truck',
  'shield-check',
  'sparkles',
  'thumbs-up',
  'users',
  'award',
  'leaf',
  'scissors',
  'utensils',
  'camera',
  'wrench',
  'graduation-cap',
  'sprout',
  'shopping-bag',
  'gift',
  'calendar',
  'smile',
  'coffee',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'whatsapp'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
