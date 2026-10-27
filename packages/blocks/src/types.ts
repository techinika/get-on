export type LinkTarget =
  | { type: 'none' }
  | { type: 'page'; pageId: string }
  | { type: 'url'; url: string }
  | { type: 'phone'; number: string }
  | { type: 'email'; address: string }
  | { type: 'whatsapp'; number: string }
  | { type: 'section'; anchor: string }
  | { type: 'pageSection'; pageId: string; anchor: string };

export type Align = 'left' | 'center';
export type Corners = 'soft' | 'sharp' | 'round';
export type ColorMode = 'light' | 'dark' | 'auto';
export type FontPair = 'friendly' | 'classic' | 'modern' | 'warm';
export type FontPairId =
  | FontPair
  | 'editorial'
  | 'clean'
  | 'bold'
  | 'elegant'
  | 'playful'
  | 'handmade'
  | 'traditional'
  | 'techy';

export type Palette =
  | 'fresh-green'
  | 'ocean'
  | 'berry'
  | 'sunset'
  | 'midnight'
  | 'charcoal'
  | string;

export type ThemeColors = {
  primary: string;
  accent: string;
  background: string;
  text: string;
  soft: string;
};

export type FontChoice = { id: string; weight: number };

/** Theme v2. Legacy v1 fields stay optional so old rows and tests still work. */
export type HeadingCase = 'normal' | 'upper';
export type HeadingTracking = 'tight' | 'normal' | 'wide';
export type DisplayScale = 'normal' | 'dramatic';
export type Rhythm = 'even' | 'alternate' | 'tinted' | 'bold';
export type ImageStyle = 'rounded' | 'sharp' | 'arch' | 'offset' | 'circle';
export type EyebrowStyle = 'chip' | 'caps' | 'line' | 'none';
export type LinkStyle = 'underline' | 'arrow' | 'plain';
export type RuleStyle = 'none' | 'hairline' | 'bold';
export type HeaderStyle = 'classic' | 'centered' | 'overlay' | 'split' | 'minimal';
export type FooterLayout = 'simple' | 'columns' | 'centered' | 'bigbrand';

export type ThemeDesign = {
  headingCase?: HeadingCase;
  headingTracking?: HeadingTracking;
  display?: DisplayScale;
  rhythm?: Rhythm;
  imageStyle?: ImageStyle;
  eyebrowStyle?: EyebrowStyle;
  linkStyle?: LinkStyle;
  rules?: RuleStyle;
  wordmark?: {
    font?: 'heading' | 'body';
    weight?: number;
    case?: 'normal' | 'upper' | 'small';
    tracking?: number;
    size?: number;
    sub?: 'none' | 'type';
  };
};

export type ThemeHeader = {
  style?: HeaderStyle;
  sticky?: boolean;
  border?: boolean;
  background?: 'plain' | 'soft' | 'brand';
  cta?: { enabled?: boolean; label?: string; link?: LinkTarget; style?: 'solid' | 'outline' };
  extraLinks?: { label: string; link: LinkTarget }[];
  announcement?: { enabled?: boolean; text?: string; link?: LinkTarget; bg?: 'brand' | 'accent' | 'dark' | 'custom'; color?: string };
};

export type ThemeFooter = {
  layout?: FooterLayout;
  about?: string;
  columns?: { title: string; links: { label: string; link: LinkTarget }[] }[];
  showSocial?: boolean;
  showContact?: boolean;
  showHours?: boolean;
  copyright?: string;
  background?: 'soft' | 'plain' | 'brand' | 'dark';
};

/** Theme v2. Legacy v1 fields stay optional so old rows and tests still work. */
export type Theme = {
  version?: 2;
  colors?: ThemeColors;
  presetId?: string | null;
  fonts?: {
    heading: FontChoice;
    body: FontChoice;
    scale: 'compact' | 'comfortable' | 'large';
  };
  buttons?: {
    shape: 'square' | 'soft' | 'round' | 'pill';
    style: 'solid' | 'outline' | 'soft';
    size: 'normal' | 'large';
    uppercase: boolean;
    shadow: boolean;
  };
  cards?: { style: 'flat' | 'outlined' | 'shadow' };
  corners: Corners;
  density?: 'compact' | 'comfortable' | 'airy';
  colorMode?: ColorMode;
  design?: ThemeDesign;
  header?: ThemeHeader;
  footer?: ThemeFooter;
  /** Legacy v1 fields. */
  palette?: Palette;
  fontPair?: FontPairId;
};

export type LinkContext = {
  getPageHref?: (pageId: string) => string;
  getPath?: (pageId: string) => string;
};

export function linkToHref(link: LinkTarget | undefined | null, ctx: LinkContext = {}): string | null {
  if (!link) return null;
  if (link.type === 'none') return null;
  if (link.type === 'page') {
    if (ctx.getPageHref) return ctx.getPageHref(link.pageId);
    return `/pages/${link.pageId}`;
  }
  if (link.type === 'section') {
    return link.anchor ? `#${link.anchor}` : null;
  }
  if (link.type === 'pageSection') {
    const base = ctx.getPath
      ? ctx.getPath(link.pageId)
      : ctx.getPageHref
        ? ctx.getPageHref(link.pageId)
        : `/pages/${link.pageId}`;
    return `${base}#${link.anchor}`;
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

export const SOCIAL_NETWORKS = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'youtube',
  'linkedin',
  'whatsapp',
  'telegram',
  'pinterest',
  'github',
  'behance',
  'dribbble',
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialLink = { network: SocialNetwork; url: string };

export type HeaderConfig = {
  logoMode: 'auto' | 'logo' | 'text';
  logoHeight: number;
  menuSource: 'pages' | 'sections' | 'both';
  menuAlign: 'left' | 'center' | 'right';
  extraLinks: { label: string; link: LinkTarget }[];
  cta: { enabled: boolean; label: string; link: LinkTarget; style: 'solid' | 'outline' };
  sticky: boolean;
  background: 'plain' | 'soft' | 'brand';
  border: boolean;
  announcement: {
    enabled: boolean;
    text: string;
    link: LinkTarget;
    bg: 'brand' | 'accent' | 'dark' | 'custom';
    color: string;
  };
};

export type FooterConfig = {
  layout: 'simple' | 'columns' | 'centered' | 'bigbrand';
  about: string;
  columns: { title: string; links: { label: string; link: LinkTarget }[] }[];
  showSocial: boolean;
  showContact: boolean;
  showHours: boolean;
  copyright: string;
  background: 'soft' | 'plain' | 'brand' | 'dark';
};

export type { SectionOptions, Hours, DayHours, Period } from './schemas';
