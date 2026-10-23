import { createBlock } from './utils';

type StarterInput = {
  businessName: string;
  businessType: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  includeContactForm?: boolean;
};

const businessMap: Record<string, any> = {
  restaurant: {
    subheading: 'Fresh food, made with care. Come and enjoy a meal with us.',
    items: [
      { icon: 'utensils', title: 'Made fresh', text: 'Our dishes are prepared every day with quality ingredients.' },
      { icon: 'clock', title: 'Open when you need us', text: 'Check our opening hours below and come by.' },
      { icon: 'heart', title: 'Made with love', text: 'We care about every plate we serve.' },
    ],
  },
  'salon-beauty': {
    subheading: 'Look good, feel great. Book a visit and let us take care of you.',
    items: [
      { icon: 'scissors', title: 'Skilled stylists', text: 'Our team knows how to bring out your best look.' },
      { icon: 'sparkles', title: 'Treatments you will love', text: 'From a quick trim to a full makeover.' },
      { icon: 'calendar', title: 'Easy to book', text: 'Call or message us to book your visit.' },
    ],
  },
  shop: {
    subheading: 'Quality products at fair prices. Visit us or get in touch to order.',
    items: [
      { icon: 'shopping-bag', title: 'Products you will love', text: 'Browse what we offer and find something for you.' },
      { icon: 'thumbs-up', title: 'Quality you can trust', text: 'We choose our products with care.' },
      { icon: 'truck', title: 'Easy to get', text: 'Ask us about pickup and delivery.' },
    ],
  },
  portfolio: {
    subheading: 'A look at my work. Let us talk about your next project.',
    items: [
      { icon: 'camera', title: 'My work', text: 'A selection of projects I am proud of.' },
      { icon: 'sparkles', title: 'My approach', text: 'I listen first, then create something that fits you.' },
      { icon: 'mail', title: 'Let us work together', text: 'Send me a message to get started.' },
    ],
  },
  consultant: {
    subheading: 'Clear advice to help you move forward. Get in touch for a first chat.',
    items: [
      { icon: 'users', title: 'Advice that fits you', text: 'Every client is different, so every plan is too.' },
      { icon: 'award', title: 'Experience you can trust', text: 'Years of practical know-how, explained simply.' },
      { icon: 'calendar', title: 'Simple to start', text: 'Book a first conversation with no pressure.' },
    ],
  },
  'church-community': {
    subheading: 'A welcoming place for everyone. Come and join us.',
    items: [
      { icon: 'users', title: 'Everyone is welcome', text: 'Join our community and feel at home.' },
      { icon: 'calendar', title: 'Join us', text: 'See when we meet and come along.' },
      { icon: 'heart', title: 'Here to help', text: 'Reach out any time. We are happy to listen.' },
    ],
  },
  'repair-services': {
    subheading: 'Fast, honest repairs you can rely on. Call us today.',
    items: [
      { icon: 'wrench', title: 'Fixed properly', text: 'We repair it right the first time.' },
      { icon: 'clock', title: 'Quick turnaround', text: 'We know you need it back soon.' },
      { icon: 'shield-check', title: 'Fair and honest', text: 'Clear prices and no surprises.' },
    ],
  },
  'farm-agriculture': {
    subheading: 'Fresh from our farm to your table. Get in touch to order.',
    items: [
      { icon: 'sprout', title: 'Grown with care', text: 'We look after our land and our crops.' },
      { icon: 'leaf', title: 'Fresh and natural', text: 'Harvested close to the day you get it.' },
      { icon: 'truck', title: 'Delivered to you', text: 'Ask us about delivery and pickup.' },
    ],
  },
  'education-tutoring': {
    subheading: 'Learning made simple and friendly. Find out how we can help.',
    items: [
      { icon: 'graduation-cap', title: 'Patient teaching', text: 'We go at the pace that works for you.' },
      { icon: 'smile', title: 'Friendly lessons', text: 'Learning is easier when it is enjoyable.' },
      { icon: 'calendar', title: 'Flexible times', text: 'Choose times that fit your week.' },
    ],
  },
  other: {
    subheading: 'Welcome! Here is a little about what we do and how to reach us.',
    items: [
      { icon: 'star', title: 'What we do', text: 'Tell visitors about your main service or product.' },
      { icon: 'thumbs-up', title: 'Why choose us', text: 'Share what makes you different.' },
      { icon: 'mail', title: 'Get in touch', text: 'Make it easy for people to contact you.' },
    ],
  },
};

export function generateStarterContent(input: StarterInput) {
  const blocks: any[] = [];
  const data = businessMap[input.businessType] || businessMap.other;
  const subheading = input.description ? input.description : data.subheading;

  let buttonLink: any = { type: 'none' };
  if (input.phone) buttonLink = { type: 'phone', number: input.phone };
  else if (input.email) buttonLink = { type: 'email', address: input.email };

  blocks.push(
    createBlock('hero', {
      props: {
        heading: `Welcome to ${input.businessName}`,
        subheading,
        buttonLabel: 'Contact us',
        buttonLink,
        imageId: null,
        layout: 'text-only',
        align: 'center',
        background: 'soft',
      },
    }),
  );

  if (input.description && input.description.trim()) {
    blocks.push(createBlock('heading', { props: { text: 'About us', level: 'h2', align: 'left', background: 'plain' } }));
    blocks.push(
      createBlock('text', {
        props: {
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }] },
          align: 'left',
          background: 'plain',
        },
      }),
    );
  }

  blocks.push(
    createBlock('features', {
      props: {
        heading: 'What we offer',
        items: data.items,
        columns: 3,
        background: 'plain',
      },
    }),
  );

  if (input.phone || input.email || input.address) {
    blocks.push(
      createBlock('contact-details', {
        props: {
          heading: 'Find us',
          phone: input.phone || '',
          email: input.email || '',
          address: input.address || '',
          hours: '',
          showMapLink: !!input.address,
          background: 'soft',
        },
      }),
    );
  }

  if (input.includeContactForm) {
    blocks.push(
      createBlock('contact-form', {
        props: {
          heading: 'Send us a message',
          intro: 'Fill in the form and we will get back to you.',
          variation: 'classic',
          showName: true,
          showPhone: false,
          phoneRequired: false,
          submitLabel: 'Send message',
          consentText: 'We will only use your details to reply to your message.',
          background: 'plain',
        },
      }),
    );
  }

  return { schemaVersion: 3 as const, blocks };
}
