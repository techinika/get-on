import { z } from 'zod';
import { ICON_NAMES, SOCIAL_NETWORKS } from './types';

export const linkTargetSchema: z.ZodType<any> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('page'), pageId: z.string().min(1) }),
  z.object({
    type: z.literal('url'),
    url: z.string().refine(
      (url) => {
        try {
          const u = new URL(url);
          return (u.protocol === 'http:' || u.protocol === 'https:') && /^https?:\/\//.test(url);
        } catch {
          return false;
        }
      },
      { message: 'Invalid URL' },
    ),
  }),
  z.object({ type: z.literal('phone'), number: z.string().min(1) }),
  z.object({ type: z.literal('email'), address: z.string().email() }),
  z.object({ type: z.literal('whatsapp'), number: z.string().min(1) }),
]);

export const backgroundSchema = z.enum(['plain', 'soft', 'brand']).default('plain');
export const alignSchema = z.enum(['left', 'center']).default('left');

const heroSchema = z.object({
  type: z.literal('hero'),
  props: z
    .object({
      heading: z.string().max(120).default('Your headline goes here'),
      subheading: z
        .string()
        .max(300)
        .default('Say in one or two sentences what you do and who you help.'),
      buttonLabel: z.string().max(30).default('Get in touch'),
      buttonLink: linkTargetSchema.optional().default({ type: 'none' }),
      imageId: z.string().uuid().nullable().default(null),
      layout: z.enum(['image-right', 'image-left', 'image-background', 'text-only']).default('text-only'),
      align: alignSchema.default('center'),
      background: backgroundSchema.default('soft'),
    })
    .default({}),
});

const headingSchema = z.object({
  type: z.literal('heading'),
  props: z
    .object({
      text: z.string().max(200).default('A new heading'),
      level: z.enum(['h2', 'h3']).default('h2'),
      align: alignSchema.default('left'),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const textSchema = z.object({
  type: z.literal('text'),
  props: z
    .object({
      content: z.any().optional(),
      align: alignSchema.default('left'),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const imageSchema = z.object({
  type: z.literal('image'),
  props: z
    .object({
      imageId: z.string().uuid().nullable().default(null),
      alt: z.string().max(200).default(''),
      caption: z.string().max(200).default(''),
      size: z.enum(['small', 'medium', 'full']).default('medium'),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const gallerySchema = z.object({
  type: z.literal('gallery'),
  props: z
    .object({
      imageIds: z.array(z.string().uuid()).max(12).default([]),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const featuresSchema = z.object({
  type: z.literal('features'),
  props: z
    .object({
      heading: z.string().max(120).default('What we offer'),
      items: z
        .array(
          z.object({
            icon: z.enum(ICON_NAMES),
            title: z.string().max(60),
            text: z.string().max(200),
          }),
        )
        .min(1)
        .max(6)
        .default([
          { icon: 'star', title: 'Your first point', text: 'Explain this in one short sentence.' },
          { icon: 'thumbs-up', title: 'Your second point', text: 'Explain this in one short sentence.' },
          { icon: 'heart', title: 'Your third point', text: 'Explain this in one short sentence.' },
        ]),
      columns: z.union([z.literal(2), z.literal(3)]).default(3),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const faqSchema = z.object({
  type: z.literal('faq'),
  props: z
    .object({
      heading: z.string().max(120).default('Questions people ask'),
      items: z
        .array(
          z.object({
            question: z.string().max(150),
            answer: z.string().max(600),
          }),
        )
        .min(1)
        .max(8)
        .default([
          { question: 'How do I get started?', answer: 'Just fill in the details and we will set things up for you.' },
          { question: 'Can I change things later?', answer: 'Yes, you can edit your pages at any time.' },
        ]),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const contactDetailsSchema = z.object({
  type: z.literal('contact-details'),
  props: z
    .object({
      heading: z.string().max(120).default('Find us'),
      phone: z.string().default(''),
      email: z.string().default(''),
      address: z.string().default(''),
      hours: z.string().max(300).default(''),
      showMapLink: z.boolean().default(true),
      background: backgroundSchema.default('soft'),
    })
    .default({}),
});

const socialLinksSchema = z.object({
  type: z.literal('social-links'),
  props: z
    .object({
      items: z
        .array(
          z.object({
            network: z.enum(SOCIAL_NETWORKS),
            url: z.string().default(''),
          }),
        )
        .min(1)
        .max(6)
        .default([{ network: 'facebook', url: '' }]),
      align: alignSchema.default('center'),
      background: backgroundSchema.default('plain'),
    })
    .default({}),
});

const buttonSchema = z.object({
  type: z.literal('button'),
  props: z
    .object({
      label: z.string().max(30).default('Click here'),
      link: linkTargetSchema.optional().default({ type: 'none' }),
      style: z.enum(['solid', 'outline']).default('solid'),
      align: alignSchema.default('center'),
    })
    .default({}),
});

const contactFormSchema = z.object({
  type: z.literal('contact-form'),
  props: z.object({ heading: z.string().max(120).default('Send us a message') }).default({}),
});

const spacerSchema = z.object({
  type: z.literal('spacer'),
  props: z.object({ height: z.enum(['small', 'medium', 'large']).default('medium') }).default({}),
});

const dividerSchema = z.object({
  type: z.literal('divider'),
  props: z.object({}).default({}),
});

export const blockSchema = z.discriminatedUnion('type', [
  heroSchema,
  headingSchema,
  textSchema,
  imageSchema,
  gallerySchema,
  featuresSchema,
  faqSchema,
  contactDetailsSchema,
  socialLinksSchema,
  buttonSchema,
  contactFormSchema,
  spacerSchema,
  dividerSchema,
]);

export const blockWithIdSchema = z.intersection(
  blockSchema,
  z.object({
    id: z.string().min(10).max(20),
  }),
);

export const pageContentSchema = z.object({
  schemaVersion: z.literal(2),
  blocks: z.array(blockWithIdSchema).max(60),
});
