import { createBlock } from './utils';

export type TemplateCategory = 'section' | 'form' | 'embed';

export type ProjectContext = {
  businessName: string;
  businessType?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  pages?: Array<{ id: string; title: string; path: string }>;
};

export type SectionTemplate = {
  id: string;
  pluginId: string;
  category: TemplateCategory;
  name: string;
  description: string;
  tags: string[];
  build: (ctx: ProjectContext) => any[];
};

function contactPageLink(ctx: ProjectContext): any {
  const page = (ctx.pages ?? []).find((p) => p.path.toLowerCase().includes('contact'));
  if (page) return { type: 'page', pageId: page.id };
  return { type: 'none' };
}

function details(ctx: ProjectContext) {
  return {
    phone: ctx.contact?.phone ?? '',
    email: ctx.contact?.email ?? '',
    address: ctx.contact?.address ?? '',
    hours: ctx.contact?.hours ?? '',
    showMapLink: Boolean(ctx.contact?.address),
  };
}

export const CONTACT_TEMPLATES: SectionTemplate[] = [
  {
    id: 'contact.section.side-by-side',
    pluginId: 'contact',
    category: 'section',
    name: 'Side by side',
    description: 'Your details on one side, the form on the other.',
    tags: ['contact', 'form', 'details', 'split'],
    build: (ctx) => [
      createBlock('contact-form', {
        props: {
          heading: 'Get in touch',
          variation: 'split',
          background: 'plain',
          ...details(ctx),
        },
      }),
    ],
  },
  {
    id: 'contact.section.details-above',
    pluginId: 'contact',
    category: 'section',
    name: 'Details above the form',
    description: 'Your contact details first, then a simple form.',
    tags: ['contact', 'form', 'details'],
    build: (ctx) => [
      createBlock('contact-details', {
        props: { heading: 'Find us', background: 'soft', ...details(ctx) },
      }),
      createBlock('contact-form', {
        props: { variation: 'classic', background: 'plain' },
      }),
    ],
  },
  {
    id: 'contact.section.big-headline',
    pluginId: 'contact',
    category: 'section',
    name: 'Big headline',
    description: 'A friendly welcome with a form in a box.',
    tags: ['contact', 'form', 'hero'],
    build: () => [
      createBlock('hero', {
        props: {
          heading: 'We would love to hear from you',
          subheading: 'Tell us a little about what you need.',
          buttonLabel: '',
          buttonLink: { type: 'none' },
          layout: 'text-only',
          align: 'center',
          background: 'soft',
        },
      }),
      createBlock('contact-form', {
        props: { variation: 'boxed', background: 'plain' },
      }),
    ],
  },
  {
    id: 'contact.form.classic',
    pluginId: 'contact',
    category: 'form',
    name: 'Classic form',
    description: 'A simple, centred form.',
    tags: ['form', 'classic'],
    build: () => [createBlock('contact-form', { props: { variation: 'classic' } })],
  },
  {
    id: 'contact.form.boxed',
    pluginId: 'contact',
    category: 'form',
    name: 'Form in a box',
    description: 'A form inside a soft card.',
    tags: ['form', 'boxed'],
    build: () => [
      createBlock('contact-form', { props: { variation: 'boxed', background: 'soft' } }),
    ],
  },
  {
    id: 'contact.form.compact',
    pluginId: 'contact',
    category: 'form',
    name: 'Compact form',
    description: 'A short form with three fields.',
    tags: ['form', 'compact'],
    build: () => [createBlock('contact-form', { props: { variation: 'compact' } })],
  },
  {
    id: 'contact.form.colourful',
    pluginId: 'contact',
    category: 'form',
    name: 'Colourful form',
    description: 'A form on your brand colour.',
    tags: ['form', 'brand'],
    build: () => [
      createBlock('contact-form', { props: { variation: 'classic', background: 'brand' } }),
    ],
  },
  {
    id: 'contact.embed.footer-mini',
    pluginId: 'contact',
    category: 'embed',
    name: 'Small footer form',
    description: 'A tiny form for the bottom of a page.',
    tags: ['form', 'mini'],
    build: () => [
      createBlock('contact-form', { props: { variation: 'mini', background: 'soft' } }),
    ],
  },
  {
    id: 'contact.embed.cta-strip',
    pluginId: 'contact',
    category: 'embed',
    name: 'Call-to-action strip',
    description: 'A slim bar that invites people to get in touch.',
    tags: ['cta', 'strip'],
    build: (ctx) => [
      createBlock('contact-cta', {
        props: { layout: 'strip', primaryLink: contactPageLink(ctx) },
      }),
    ],
  },
  {
    id: 'contact.embed.cta-card',
    pluginId: 'contact',
    category: 'embed',
    name: 'Call-to-action card',
    description: 'A card with a short message and a button.',
    tags: ['cta', 'card'],
    build: (ctx) => [
      createBlock('contact-cta', {
        props: { layout: 'card', align: 'center', primaryLink: contactPageLink(ctx) },
      }),
    ],
  },
  {
    id: 'contact.embed.banner',
    pluginId: 'contact',
    category: 'embed',
    name: 'Colourful banner',
    description: 'A bold banner on your brand colour.',
    tags: ['cta', 'banner'],
    build: (ctx) => [
      createBlock('contact-cta', {
        props: { layout: 'banner', primaryLink: contactPageLink(ctx) },
      }),
    ],
  },
  {
    id: 'contact.embed.quick-buttons',
    pluginId: 'contact',
    category: 'embed',
    name: 'Quick contact buttons',
    description: 'Call, email and WhatsApp buttons.',
    tags: ['quick', 'buttons'],
    build: (ctx) => [
      createBlock('quick-contact', {
        props: {
          layout: 'row',
          phone: ctx.contact?.phone ?? '',
          email: ctx.contact?.email ?? '',
          whatsapp: ctx.contact?.phone ?? '',
        },
      }),
    ],
  },
];

const ALL_TEMPLATES: SectionTemplate[] = [...CONTACT_TEMPLATES];

export function getTemplate(id: string): SectionTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function listTemplates(): SectionTemplate[] {
  return ALL_TEMPLATES;
}

export function templatesForPlugin(pluginId: string): SectionTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.pluginId === pluginId);
}

export function templatesByCategory(pluginId: string, category: TemplateCategory): SectionTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.pluginId === pluginId && t.category === category);
}
