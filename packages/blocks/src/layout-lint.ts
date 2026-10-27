import { contrastRatio, deriveTokens } from './colour';
import { resolveThemeColors } from './theme';
import type { Theme } from './types';

export type LayoutLintSeverity = 'error' | 'warn';

export type LayoutLintIssue = {
  id: string;
  severity: LayoutLintSeverity;
  message: string;
  blockId?: string;
  autofix?: { blockId: string; props: Record<string, unknown> };
};

export type LayoutLintResult = {
  issues: LayoutLintIssue[];
  errors: LayoutLintIssue[];
  warnings: LayoutLintIssue[];
};

export type LayoutLintInput = {
  blocks: Array<Record<string, any>>;
  theme?: Theme;
  onePage?: boolean;
  density?: 'compact' | 'comfortable' | 'airy';
  archetype?: string;
  strictText?: boolean;
};

const HERO_WORDS: Record<string, [number, number]> = {
  editorial: [3, 9],
  centered: [3, 9],
  split: [5, 12],
  fullbleed: [4, 10],
  minimal: [5, 14],
  'card-over-image': [4, 10],
  'offset-frame': [5, 12],
  diagonal: [4, 10],
  'product-shot': [4, 10],
  arch: [4, 10],
};

const ALTERNATE_VARIANTS: Record<string, string[]> = {
  features: ['bento', 'rows', 'tiles', 'icons'],
  services: ['cards-image', 'columns-rules', 'cards', 'list'],
  gallery: ['mosaic', 'filmstrip', 'grid'],
  testimonials: ['wall', 'spotlight', 'cards', 'single'],
  'image-text': ['overlap', 'fullbleed-split', 'offset', 'split'],
  cta: ['split', 'ribbon', 'banner', 'card'],
  products: ['lookbook', 'catalog'],
  projects: ['list', 'featured'],
  steps: ['big-numbers', 'horizontal', 'vertical'],
  team: ['offset', 'grid'],
  menu: ['board'],
};

function words(value: unknown): number {
  return typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean).length : 0;
}

function isStrong(block: Record<string, any>): boolean {
  const bg = block.sec?.bg;
  return bg?.type === 'brand' || bg?.type === 'accent' || (bg?.type === 'color' && bg?.color && bg.color !== '#FFFFFF' && bg.color !== '#ffffff');
}

function isCentredText(block: Record<string, any>): boolean {
  return ['hero', 'text', 'quote'].includes(String(block.type)) && String(block.props?.align ?? 'left') === 'center';
}

function hasLetterMark(value: unknown, depth = 0): boolean {
  if (!value || depth > 3) return false;
  if (Array.isArray(value)) return value.some((item) => hasLetterMark(item, depth + 1));
  if (typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.monogram || record.letterMark || record.initials || record.logoType === 'letter' || record.markType === 'letter') return true;
  return Object.values(record).some((entry) => hasLetterMark(entry, depth + 1));
}

function issue(id: string, severity: LayoutLintSeverity, message: string, blockId?: string, autofix?: LayoutLintIssue['autofix']): LayoutLintIssue {
  return { id, severity, message, ...(blockId ? { blockId } : {}), ...(autofix ? { autofix } : {}) };
}

export function lintLayout(input: LayoutLintInput): LayoutLintResult {
  const blocks = input.blocks ?? [];
  const issues: LayoutLintIssue[] = [];
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const heroes = blocks.filter((block) => block.type === 'hero');

  if (first?.type !== 'hero') {
    issues.push(issue('hero_first', 'error', 'The page must start with a hero.', first?.id));
  }
  if (heroes.length > 1) {
    issues.push(issue('one_h1', 'error', 'A page can only have one hero.', heroes[1]?.id));
  }
  if (blocks.length > 1 && !['cta', 'contact-form', 'quick-contact', 'contact-details'].includes(String(last?.type))) {
    issues.push(issue('cta_before_footer', 'warn', 'Add a call to action or contact block near the end.', last?.id));
  }

  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1]!;
    const current = blocks[index]!;
    if (previous.type === current.type && String(previous.props?.layout ?? '') === String(current.props?.layout ?? '')) {
      const alternatives = ALTERNATE_VARIANTS[String(current.type)] ?? [];
      const nextVariant = alternatives.find((variant) => variant !== String(current.props?.layout ?? ''));
      issues.push(issue(
        'no_adjacent_same_layout',
        'warn',
        `Two ${String(current.type)} sections in a row use the same layout.`,
        current.id,
        nextVariant ? { blockId: String(current.id ?? index), props: { layout: nextVariant } } : undefined,
      ));
    }
    if (isStrong(previous) && isStrong(current)) {
      issues.push(issue('rhythm_respected', 'error', 'Two strong background sections are next to each other.', current.id));
    }
  }

  let centredRun = 0;
  for (const block of blocks) {
    centredRun = isCentredText(block) ? centredRun + 1 : 0;
    if (centredRun > 2) {
      issues.push(issue('max_consecutive_centred_text', 'warn', 'More than two centred text sections in a row.', block.id));
      break;
    }
  }

  const hero = heroes[0];
  if (hero) {
    const layout = String(hero.props?.layout ?? 'split');
    const band = HERO_WORDS[layout];
    if (input.strictText !== false && band) {
      const count = words(hero.props?.heading);
      if (count < band[0] || count > band[1]) {
        issues.push(issue('text_within_variant_limits', 'error', `The ${layout} headline should be ${band[0]} to ${band[1]} words.`, hero.id));
      }
    }
    const buttonCount = [hero.props?.buttonLabel, hero.props?.button2Label].filter((label) => typeof label === 'string' && label.trim()).length;
    if (buttonCount > 2) {
      issues.push(issue('button_count', 'error', 'The hero can have at most two buttons.', hero.id));
    }
    const introWords = words(hero.props?.subheading);
    if (input.strictText !== false && introWords > 0 && (introWords < 8 || introWords > 32)) {
      issues.push(issue('text_within_variant_limits', 'error', 'The hero intro should be 8 to 32 words.', hero.id));
    }
  }

  const alignments = new Set(blocks.map((block) => String(block.props?.align ?? 'left')));
  if (alignments.size > 1) {
    issues.push(issue('consistent_alignment', 'warn', 'The page mixes left and centred headings.'));
  }

  if (input.density && input.theme?.density && input.density !== input.theme.density) {
    issues.push(issue('density_matches_spec', 'warn', `The design asks for ${input.density} spacing.`));
  }

  const count = blocks.length;
  if (input.onePage) {
    if (count > 12) issues.push(issue('section_count_range', 'warn', 'One-page sites should have at most 12 sections.'));
  } else if (count < 5 || count > 9) {
    issues.push(issue('section_count_range', 'warn', 'A home page should have 5 to 9 sections.'));
  }

  for (const block of blocks) {
    const props = block.props ?? {};
    const hasContent = Object.entries(props).some(([key, value]) => !['layout', 'align', 'ratio', 'imageRatio', 'imageId', 'frame', 'imageSide'].includes(key) && value !== '' && value != null && !(Array.isArray(value) && value.length === 0));
    if (!hasContent) issues.push(issue('no_empty_sections', 'error', 'This section has no content.', block.id));
    if (['image', 'image-text', 'gallery', 'team', 'products', 'projects'].includes(String(block.type)) && !props.imageId && !props.image && !(Array.isArray(props.items) && props.items.length) && !(Array.isArray(props.images) && props.images.length)) {
      issues.push(issue('images_have_slots_or_fallback', 'warn', 'This section has no pictures; the design fallback will be used.', block.id));
    }
    if (block.sec?.shape && block === first && block.sec.shape.top && block.sec.shape.top !== 'none') {
      issues.push(issue('shape_not_on_edges', 'error', 'The first section cannot have a top shape.', block.id));
    }
    if (block.sec?.shape && block === last && block.sec.shape.bottom && block.sec.shape.bottom !== 'none') {
      issues.push(issue('shape_not_on_edges', 'error', 'The last section cannot have a bottom shape.', block.id));
    }
    if (hasLetterMark(block)) {
      issues.push(issue('no_letter_mark', 'error', 'Never use a letter, monogram or initials as the business mark.', block.id));
    }
  }

  if (input.theme) {
    const colours = resolveThemeColors(input.theme);
    const tokens = deriveTokens(colours, input.theme);
    if (contrastRatio(tokens['--s-text']!, tokens['--s-bg']!) < 4.5) {
      issues.push(issue('min_contrast', 'error', 'Body text does not meet the contrast target.'));
    }
    if (contrastRatio(tokens['--s-on-primary']!, tokens['--s-primary']!) < 4.5) {
      issues.push(issue('min_contrast', 'error', 'Text on the main colour does not meet the contrast target.'));
    }
    if (contrastRatio(tokens['--s-on-accent']!, tokens['--s-accent']!) < 4.5) {
      issues.push(issue('min_contrast', 'error', 'Text on the accent colour does not meet the contrast target.'));
    }
  }

  return {
    issues,
    errors: issues.filter((entry) => entry.severity === 'error'),
    warnings: issues.filter((entry) => entry.severity === 'warn'),
  };
}

export function applyLayoutAutofixes(blocks: Array<Record<string, any>>): Array<Record<string, any>> {
  return blocks.map((block, index) => {
    const previous = blocks[index - 1];
    if (!previous || previous.type !== block.type) return block;
    const alternatives = ALTERNATE_VARIANTS[String(block.type)] ?? [];
    const nextVariant = alternatives.find((variant) => variant !== String(block.props?.layout ?? ''));
    return nextVariant ? { ...block, props: { ...(block.props ?? {}), layout: nextVariant } } : block;
  });
}
