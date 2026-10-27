import { z } from 'zod';
import { ICON_NAMES } from './icons';
import { SOCIAL_NETWORKS } from './types';

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const hexSchema = z.string().regex(HEX, 'Use a 6-digit colour like #0B6B4F');

export const linkTargetSchema: z.ZodType<any> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('page'), pageId: z.string().min(1) }),
  z.object({
    type: z.literal('url'),
    url: z.string().refine((url) => {
      try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') && /^https?:\/\//.test(url);
      } catch { return false; }
    }, { message: 'Invalid URL' }),
  }),
  z.object({ type: z.literal('phone'), number: z.string().min(1) }),
  z.object({ type: z.literal('email'), address: z.string().email() }),
  z.object({ type: z.literal('whatsapp'), number: z.string().min(1) }),
  z.object({ type: z.literal('section'), anchor: z.string().min(1).max(40) }),
  z.object({ type: z.literal('pageSection'), pageId: z.string().min(1), anchor: z.string().min(1).max(40) }),
]);

export const alignSchema = z.enum(['left', 'center']).default('left');
export const backgroundSchema = z.enum(['plain', 'soft', 'brand', 'accent', 'color', 'gradient', 'image']).default('plain');
export const spaceSchema = z.enum(['none', 'small', 'normal', 'large', 'xlarge']).default('normal');
export const widthSchema = z.enum(['narrow', 'normal', 'wide', 'full']).default('normal');
export const deviceSchema = z.enum(['phone', 'tablet', 'computer']);

export const sectionOptionsSchema = z.object({
  bg: z.object({
    type: z.enum(['plain', 'soft', 'brand', 'accent', 'color', 'gradient', 'image']).default('plain'),
    color: z.string().regex(HEX).default('#FFFFFF'),
    color2: z.string().regex(HEX).default('#F5A524'),
    angle: z.union([z.literal(0), z.literal(90), z.literal(135), z.literal(180)]).default(135),
    imageId: z.string().uuid().nullable().default(null),
    overlay: z.enum(['none', 'dark', 'light', 'brand']).default('none'),
    overlayStrength: z.number().min(0).max(80).default(50),
    textOn: z.enum(['auto', 'light', 'dark']).default('auto'),
  }).default({}),
  spaceTop: spaceSchema,
  spaceBottom: spaceSchema,
  width: widthSchema,
  anchor: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).or(z.literal('')).default(''),
  menuLabel: z.string().max(24).default(''),
  hideOn: z.array(deviceSchema).max(3).default([]).refine((v) => v.length < 3, { message: 'Hide on at most two devices' }),
  hidden: z.boolean().default(false),
  shape: z.object({
    top: z.enum(['none', 'slant', 'curve', 'wave']).default('none'),
    bottom: z.enum(['none', 'slant', 'curve', 'wave']).default('none'),
  }).default({}),
  pattern: z.enum(['none', 'dots', 'grid', 'lines', 'noise']).default('none'),
  rule: z.enum(['none', 'top', 'bottom']).default('none'),
}).default({});

const img = z.string().uuid().nullable().default(null);
const str = (max: number, def = '') => z.string().max(max).default(def);
const link = linkTargetSchema.optional().default({ type: 'none' });

const includeIfSchema = z.enum(['phone', 'email', 'address', 'hours', 'social', 'logo', 'description', 'tagline', 'city', 'areaServed']).optional();
const slotMetaSchema = z.object({ hideIfEmpty: z.boolean().default(false) }).optional();
const base = {
  sec: sectionOptionsSchema,
  background: backgroundSchema.optional(),
  includeIf: includeIfSchema,
  slotMeta: slotMetaSchema,
};

const heroLayouts = [
  'split', 'centered', 'fullbleed', 'editorial', 'card-over-image', 'minimal',
  'offset-frame', 'diagonal', 'product-shot', 'arch',
] as const;
const heroSchema = z.object({ type: z.literal('hero'), props: z.object({
  eyebrow: str(40), heading: str(120, 'Your headline goes here'),
  subheading: str(300, 'Say in one or two sentences what you do and who you help.'),
  buttonLabel: str(30, 'Get in touch'), buttonLink: link,
  button2Label: str(30), button2Link: link,
  highlights: z.array(z.string().max(40)).max(4).default([]),
  imageId: img, layout: z.enum(heroLayouts).default('split'),
  height: z.enum(['auto', 'tall', 'screen']).default('auto'), align: alignSchema,
  imageSide: z.enum(['right', 'left']).default('right'),
  valign: z.enum(['center', 'end']).default('center'),
  textWidth: z.enum(['narrow', 'normal', 'wide']).default('normal'),
  frame: z.enum(['none', 'offset', 'arch', 'browser']).default('none'),
  badgeText: str(24),
  cardSide: z.enum(['left', 'right']).default('left'),
  imageRatio: z.enum(['auto', '4:5', '3:4', '1:1', '16:9', '21:9']).default('auto'),
  ...base,
}).default({}) });

const headingSchema = z.object({ type: z.literal('heading'), props: z.object({
  eyebrow: str(40), text: str(200, 'A new heading'), level: z.enum(['h1', 'h2', 'h3']).default('h2'),
  align: alignSchema, ...base,
}).default({}) });

const textSchema = z.object({ type: z.literal('text'), props: z.object({
  content: z.any().optional(), columns: z.union([z.literal(1), z.literal(2)]).default(1),
  size: z.enum(['normal', 'large']).default('normal'), align: alignSchema, ...base,
}).default({}) });

const imageTextSchema = z.object({ type: z.literal('image-text'), props: z.object({
  imageId: img, imagePosition: z.enum(['left', 'right']).default('left'),
  ratio: z.enum(['4:3', '3:2', '4:5', '1:1', '3:4', '16:9']).default('4:3'),
  imageStyle: z.enum(['rounded', 'sharp', 'arch', 'circle', 'offset']).default('rounded'),
  layout: z.enum(['standard', 'overlap', 'fullbleed-split']).default('standard'),
  badge: str(30), eyebrow: str(40), heading: str(120, 'Our story'), text: z.any().optional(),
  buttonLabel: str(30), buttonLink: link, button2Label: str(30), button2Link: link, ...base,
}).default({}) });

const imageSchema = z.object({ type: z.literal('image'), props: z.object({
  imageId: img, alt: str(200), caption: str(200), size: z.enum(['small', 'medium', 'full']).default('medium'),
  ratio: z.enum(['natural', '4:3', '1:1', '3:2', '16:9']).default('natural'), link,
  zoom: z.boolean().default(false), rounded: z.boolean().default(true), ...base,
}).default({}) });

const gallerySchema = z.object({ type: z.literal('gallery'), props: z.object({
  heading: str(120), items: z.array(z.object({ imageId: img, caption: str(100) })).max(24).default([]),
  layout: z.enum(['grid', 'masonry', 'carousel', 'mosaic', 'filmstrip']).default('grid'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  ratio: z.enum(['square', '4:3', '3:2', '16:9']).default('square'),
  gap: z.enum(['small', 'medium', 'large']).default('medium'), zoom: z.boolean().default(true),
  showCaptions: z.boolean().default(false), ...base,
}).default({}) });

const videoSchema = z.object({ type: z.literal('video'), props: z.object({
  url: str(500), title: str(80), posterId: img, caption: str(200), ...base,
}).default({}) });

const beforeAfterSchema = z.object({ type: z.literal('before-after'), props: z.object({
  heading: str(120), items: z.array(z.object({ beforeId: img, afterId: img, caption: str(100) })).min(1).max(6).default([{ beforeId: null, afterId: null, caption: '' }]),
  ratio: z.enum(['4:3', '1:1', '3:2']).default('4:3'), ...base,
}).default({}) });

const itemLink = z.object({ icon: z.enum(ICON_NAMES as unknown as [string, ...string[]]).default('star'), title: z.string().max(80).default(''), text: z.string().max(200).default(''), imageId: img, link });

const featuresSchema = z.object({ type: z.literal('features'), props: z.object({
  heading: str(120, 'What we offer'), intro: str(300),
  items: z.array(itemLink).min(1).max(12).default([
    { icon: 'star', title: 'Your first point', text: 'Explain this in one short sentence.', imageId: null, link: { type: 'none' } },
    { icon: 'thumbs-up', title: 'Your second point', text: 'Explain this in one short sentence.', imageId: null, link: { type: 'none' } },
    { icon: 'heart', title: 'Your third point', text: 'Explain this in one short sentence.', imageId: null, link: { type: 'none' } },
  ]),
  layout: z.enum(['cards', 'icons', 'numbered', 'image-cards', 'bento', 'rows', 'tiles']).default('cards'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3), ...base,
}).default({}) });

const servicesSchema = z.object({ type: z.literal('services'), props: z.object({
  heading: str(120, 'Services and prices'), intro: str(300),
  items: z.array(z.object({ icon: z.enum(ICON_NAMES as unknown as [string, ...string[]]).default('star'), title: str(80), description: str(200), price: str(20), imageId: img, linkLabel: str(24), link })).min(1).max(24).default([
    { icon: 'star', title: 'Service one', description: 'A short description of this service.', price: '$20', imageId: null, linkLabel: '', link: { type: 'none' } },
    { icon: 'star', title: 'Service two', description: 'A short description of this service.', price: '$35', imageId: null, linkLabel: '', link: { type: 'none' } },
    { icon: 'star', title: 'Service three', description: 'A short description of this service.', price: '$50', imageId: null, linkLabel: '', link: { type: 'none' } },
  ]), layout: z.enum(['cards', 'list', 'icons', 'cards-image', 'columns-rules']).default('list'),
  columns: z.union([z.literal(2), z.literal(3)]).default(3), ...base,
}).default({}) });

const productsSchema = z.object({ type: z.literal('products'), props: z.object({
  heading: str(120, 'Products'), intro: str(300),
  items: z.array(z.object({ imageId: img, title: str(80), description: str(160), price: str(20), oldPrice: str(20), badge: str(20), soldOut: z.boolean().default(false), link })).min(1).max(24).default([
    { imageId: null, title: 'Product one', description: 'A short description.', price: '$20', oldPrice: '', badge: '', soldOut: false, link: { type: 'none' } },
    { imageId: null, title: 'Product two', description: 'A short description.', price: '$35', oldPrice: '', badge: '', soldOut: false, link: { type: 'none' } },
    { imageId: null, title: 'Product three', description: 'A short description.', price: '$50', oldPrice: '', badge: '', soldOut: false, link: { type: 'none' } },
  ]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  ratio: z.enum(['1:1', '4:3', '3:4']).default('1:1'),
  orderMode: z.enum(['whatsapp', 'link', 'email', 'call', 'none']).default('whatsapp'),
  layout: z.enum(['grid', 'lookbook', 'catalog']).default('grid'),
  orderLabel: str(24, 'Order now'), whatsapp: str(30), email: str(200), ...base,
}).default({}) });

const menuSchema = z.object({ type: z.literal('menu'), props: z.object({
  heading: str(120, 'Menu'), note: str(200),
  sections: z.array(z.object({ title: str(60), note: str(120), items: z.array(z.object({
    name: str(80), description: str(200), price: str(20),
    tags: z.array(z.enum(['vegetarian', 'vegan', 'spicy', 'gluten-free', 'halal', 'new', 'popular'])).max(3).default([]),
  })).min(1).max(30).default([{ name: 'Dish one', description: '', price: '$12', tags: [] }]) })).min(1).max(12).default([
    { title: 'Starters', note: '', items: [{ name: 'Dish one', description: 'A short description.', price: '$12', tags: [] }] },
  ]),
  layout: z.enum(['single', 'two-columns', 'board']).default('single'), leaders: z.boolean().default(true),
  fileId: img, fileLabel: str(40, 'Download the full menu (PDF)'), ...base,
}).default({}) });

const pricingSchema = z.object({ type: z.literal('pricing'), props: z.object({
  heading: str(120, 'Pricing'), intro: str(300),
  plans: z.array(z.object({ name: str(40), price: str(20), period: str(20), description: str(160), features: z.array(z.string().max(80)).max(10).default([]), buttonLabel: str(24), buttonLink: link, highlighted: z.boolean().default(false) })).min(1).max(4).default([
    { name: 'Basic', price: '$20', period: 'per month', description: '', features: [], buttonLabel: 'Choose', buttonLink: { type: 'none' }, highlighted: false },
  ]), highlightLabel: str(24, 'Most popular'), ...base,
}).default({}) });

const projectsSchema = z.object({ type: z.literal('projects'), props: z.object({
  heading: str(120, 'Our work'), intro: str(300),
  items: z.array(z.object({ imageId: img, title: str(80), category: str(30), description: str(200), result: str(80), link })).min(1).max(18).default([
    { imageId: null, title: 'Project one', category: '', description: 'A short description.', result: '', link: { type: 'none' } },
    { imageId: null, title: 'Project two', category: '', description: 'A short description.', result: '', link: { type: 'none' } },
    { imageId: null, title: 'Project three', category: '', description: 'A short description.', result: '', link: { type: 'none' } },
  ]), layout: z.enum(['grid', 'featured', 'list']).default('grid'),
  columns: z.union([z.literal(2), z.literal(3)]).default(3), zoom: z.boolean().default(false), ...base,
}).default({}) });

const testimonialsSchema = z.object({ type: z.literal('testimonials'), props: z.object({
  heading: str(120, 'What people say'),
  items: z.array(z.object({ quote: str(400), name: str(60), role: str(60), photoId: img, rating: z.number().min(0).max(5).default(5) })).min(1).max(9).default([
    { quote: 'A lovely experience from start to finish.', name: 'A happy customer', role: '', photoId: null, rating: 5 },
  ]), layout: z.enum(['cards', 'single', 'carousel', 'wall', 'spotlight']).default('cards'),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3), ...base,
}).default({}) });

const teamSchema = z.object({ type: z.literal('team'), props: z.object({
  heading: str(120, 'Meet the team'), intro: str(300),
  items: z.array(z.object({ photoId: img, name: str(60), role: str(60), bio: str(160), email: str(200), phone: str(30), linkedin: str(300) })).min(1).max(12).default([
    { photoId: null, name: 'Team member', role: '', bio: '', email: '', phone: '', linkedin: '' },
  ]), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  photoStyle: z.enum(['square', 'circle', 'arch']).default('square'),
  layout: z.enum(['grid', 'offset']).default('grid'), ...base,
}).default({}) });

const statsSchema = z.object({ type: z.literal('stats'), props: z.object({
  heading: str(120), items: z.array(z.object({ value: str(12), label: str(40) })).min(2).max(6).default([
    { value: '10+', label: 'Years open' }, { value: '500', label: 'Happy customers' },
  ]), layout: z.enum(['row', 'cards', 'big-rules']).default('row'), ...base,
}).default({}) });

const logosSchema = z.object({ type: z.literal('logos'), props: z.object({
  heading: str(60, 'Trusted by'), items: z.array(z.object({ imageId: img, name: str(60), link })).min(2).max(12).default([
    { imageId: null, name: 'Client one', link: { type: 'none' } }, { imageId: null, name: 'Client two', link: { type: 'none' } },
  ]), grayscale: z.boolean().default(true), ...base,
}).default({}) });

const stepsSchema = z.object({ type: z.literal('steps'), props: z.object({
  heading: str(120, 'How it works'), intro: str(300),
  items: z.array(z.object({ title: str(60), text: str(200), icon: z.enum(ICON_NAMES as unknown as [string, ...string[]]).default('star') })).min(2).max(8).default([
    { title: 'Step one', text: 'Tell us what you need.', icon: 'star' },
    { title: 'Step two', text: 'We get to work.', icon: 'star' },
  ]), layout: z.enum(['horizontal', 'vertical', 'big-numbers']).default('horizontal'), ...base,
}).default({}) });

const faqSchema = z.object({ type: z.literal('faq'), props: z.object({
  heading: str(120, 'Questions people ask'),
  items: z.array(z.object({ question: z.string().max(150), answer: z.string().max(600) })).min(1).max(12).default([
    { question: 'How do I get started?', answer: 'Just fill in the details and we will set things up for you.' },
    { question: 'Can I change things later?', answer: 'Yes, you can edit your pages at any time.' },
  ]), columns: z.union([z.literal(1), z.literal(2)]).default(1), openFirst: z.boolean().default(false), ...base,
}).default({}) });

const quoteSchema = z.object({ type: z.literal('quote'), props: z.object({
  text: str(300, 'A few words that mean something.'), author: str(60), role: str(60),
  style: z.enum(['plain', 'big']).default('plain'), ...base,
}).default({}) });

const periodSchema = z.object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) });
const hoursDaySchema = z.union([z.literal('closed'), z.literal('24h'), z.array(periodSchema).max(2)]);
const hoursSchema = z.object({ mon: hoursDaySchema, tue: hoursDaySchema, wed: hoursDaySchema, thu: hoursDaySchema, fri: hoursDaySchema, sat: hoursDaySchema, sun: hoursDaySchema }).default({
  mon: [{ from: '09:00', to: '17:00' }], tue: [{ from: '09:00', to: '17:00' }], wed: [{ from: '09:00', to: '17:00' }],
  thu: [{ from: '09:00', to: '17:00' }], fri: [{ from: '09:00', to: '17:00' }], sat: 'closed', sun: 'closed',
});

const openingHoursSchema = z.object({ type: z.literal('opening-hours'), props: z.object({
  heading: str(60, 'Opening hours'), source: z.enum(['site', 'custom']).default('site'),
  customHours: hoursSchema, note: str(160), align: alignSchema, compactDays: z.boolean().default(false), ...base,
}).default({}) });

const mapSchema = z.object({ type: z.literal('map'), props: z.object({
  heading: str(120, 'Find us'), address: str(200), notes: str(160), showHours: z.boolean().default(false), ...base,
}).default({}) });

const contactDetailsSchema = z.object({ type: z.literal('contact-details'), props: z.object({
  heading: str(120, 'Contact us'), phone: str(30), email: str(200), address: str(200), showHours: z.boolean().default(true),
  hoursNote: str(300), showMapLink: z.boolean().default(true), showSocial: z.boolean().default(false),
  source: z.enum(['site', 'custom']).default('site'), ...base,
}).default({}) });

const contactFormSchema = z.object({ type: z.literal('contact-form'), props: z.object({
  heading: str(120, 'Send us a message'), intro: str(300, 'Fill in the form and we will get back to you.'),
  variation: z.enum(['classic', 'split', 'boxed', 'compact', 'mini']).default('classic'),
  showName: z.boolean().default(true), showPhone: z.boolean().default(false), phoneRequired: z.boolean().default(false),
  submitLabel: str(30, 'Send message'), consentText: str(160, 'We will only use your details to reply to your message.'),
  phone: str(30), email: str(200), address: str(200), hours: str(300), hoursNote: str(300),
  showMapLink: z.boolean().default(true), ...base,
}).default({}) });

const quickContactSchema = z.object({ type: z.literal('quick-contact'), props: z.object({
  showCall: z.boolean().default(true), showEmail: z.boolean().default(true), showWhatsApp: z.boolean().default(true),
  phone: str(30), email: str(200), whatsapp: str(30), layout: z.enum(['row', 'stack']).default('row'),
  align: alignSchema, ...base,
}).default({}) });

const socialLinksSchema = z.object({ type: z.literal('social-links'), props: z.object({
  source: z.enum(['site', 'custom']).default('site'),
  items: z.array(z.object({ network: z.enum(SOCIAL_NETWORKS as unknown as [string, ...string[]]), url: z.string().default('') })).max(8).default([]),
  align: alignSchema, size: z.enum(['normal', 'large']).default('normal'), ...base,
}).default({}) });

const ctaSchema = z.object({ type: z.literal('cta'), props: z.object({
  eyebrow: str(40), heading: str(120, 'Ready to talk?'), text: str(300, 'Send us a message and we will get back to you.'),
  primaryLabel: str(30, 'Contact us'), primaryLink: link, secondaryLabel: str(30), secondaryLink: link,
  layout: z.enum(['strip', 'card', 'banner', 'split', 'ribbon']).default('strip'), align: alignSchema, ...base,
}).default({}) });

const linkListSchema = z.object({ type: z.literal('link-list'), props: z.object({
  heading: str(60), items: z.array(z.object({ label: str(60), description: str(80), icon: z.enum(ICON_NAMES as unknown as [string, ...string[]]).default('star'), link })).min(1).max(12).default([
    { label: 'Send a message', description: '', icon: 'mail', link: { type: 'none' } },
  ]), style: z.enum(['solid', 'outline', 'soft']).default('solid'), ...base,
}).default({}) });

const buttonSchema = z.object({ type: z.literal('button'), props: z.object({
  label: str(30, 'Click here'), link, style: z.enum(['solid', 'outline', 'soft']).default('solid'),
  size: z.enum(['normal', 'large']).default('normal'), fullWidth: z.boolean().default(false),
  icon: z.enum(['none', 'arrow-right', 'phone', 'message-circle', 'download', 'calendar', 'external-link']).default('none'),
  align: alignSchema, ...base,
}).default({}) });

const downloadsSchema = z.object({ type: z.literal('downloads'), props: z.object({
  heading: str(120, 'Downloads'), items: z.array(z.object({ title: str(80), description: str(160), fileId: img })).min(1).max(12).default([
    { title: 'Our brochure', description: '', fileId: null },
  ]), ...base,
}).default({}) });

const spacerSchema = z.object({ type: z.literal('spacer'), props: z.object({ height: z.enum(['small', 'medium', 'large']).default('medium'), ...base }).default({}) });
const dividerSchema = z.object({ type: z.literal('divider'), props: z.object({ style: z.enum(['line', 'dots', 'short']).default('line'), ...base }).default({}) });
const sharedSchema = z.object({ type: z.literal('shared'), props: z.object({ sharedId: z.string().uuid() }) });

export const blockSchema = z.discriminatedUnion('type', [
  heroSchema, headingSchema, textSchema, imageTextSchema, imageSchema, gallerySchema, videoSchema,
  beforeAfterSchema, featuresSchema, servicesSchema, productsSchema, menuSchema, pricingSchema,
  projectsSchema, testimonialsSchema, teamSchema, statsSchema, logosSchema, stepsSchema, faqSchema,
  quoteSchema, openingHoursSchema, mapSchema, contactDetailsSchema, contactFormSchema, quickContactSchema,
  socialLinksSchema, ctaSchema, linkListSchema, buttonSchema, downloadsSchema, spacerSchema, dividerSchema,
  sharedSchema,
]);

export const blockWithIdSchema = z.intersection(blockSchema, z.object({ id: z.string().min(10).max(24), includeIf: includeIfSchema, slotMeta: slotMetaSchema, sampleOnly: z.boolean().optional() }));

export const pageContentSchema = z.object({
  schemaVersion: z.literal(4),
  blocks: z.array(blockWithIdSchema).max(60),
});

export type SectionOptions = z.infer<typeof sectionOptionsSchema>;
export type Hours = z.infer<typeof hoursSchema>;
export type DayHours = z.infer<typeof hoursDaySchema>;
export type Period = z.infer<typeof periodSchema>;
export { hoursSchema, hoursDaySchema, periodSchema };
