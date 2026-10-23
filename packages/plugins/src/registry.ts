import type { PluginManifest } from './types';

export const PLUGIN_MANIFESTS: PluginManifest[] = [
  {
    id: 'contact',
    name: 'Contact form',
    tagline: 'Let visitors send you messages from your website.',
    description: 'Let visitors send you messages from your website. You read them in Messages and get an email each time.',
    icon: 'mail',
    status: 'available',
    freeOk: true,
    blocks: ['contact-form', 'contact-cta', 'quick-contact'],
    templates: [
      'contact.section.side-by-side',
      'contact.section.details-above',
      'contact.section.big-headline',
      'contact.form.classic',
      'contact.form.boxed',
      'contact.form.compact',
      'contact.form.colourful',
      'contact.embed.footer-mini',
      'contact.embed.cta-strip',
      'contact.embed.cta-card',
      'contact.embed.banner',
      'contact.embed.quick-buttons',
    ],
    nav: [{ id: 'messages', label: 'Messages', icon: 'mail', route: 'messages', badge: 'unread' }],
    settingsRoute: 'plugins/contact',
    checklist: ['turn-on-contact', 'add-contact-form'],
  },
  {
    id: 'subscribers',
    name: 'Subscribers',
    tagline: 'Collect email addresses and send news to your visitors.',
    description: 'Collect email addresses and send news to your visitors.',
    icon: 'mail-plus',
    status: 'planned',
    freeOk: false,
    blocks: [],
    templates: [],
    nav: [],
    checklist: [],
  },
  {
    id: 'blog',
    name: 'Blog',
    tagline: 'Write posts and let visitors comment.',
    description: 'Write posts and let visitors comment.',
    icon: 'newspaper',
    status: 'planned',
    freeOk: false,
    blocks: [],
    templates: [],
    nav: [],
    checklist: [],
  },
  {
    id: 'languages',
    name: 'Languages',
    tagline: 'Show your website in more than one language.',
    description: 'Show your website in more than one language.',
    icon: 'languages',
    status: 'planned',
    freeOk: false,
    blocks: [],
    templates: [],
    nav: [],
    checklist: [],
  },
  {
    id: 'dark-mode',
    name: 'Dark and light mode',
    tagline: 'Let visitors switch between a light and a dark look.',
    description: 'Let visitors switch between a light and a dark look.',
    icon: 'moon',
    status: 'planned',
    freeOk: false,
    blocks: [],
    templates: [],
    nav: [],
    checklist: [],
  },
  {
    id: 'byok-ai',
    name: 'AI with your own key',
    tagline: 'Use your own AI account instead of Get-On credits.',
    description: 'Use your own AI account instead of Get-On credits. Paid plans only.',
    icon: 'key-round',
    status: 'planned',
    freeOk: false,
    blocks: [],
    templates: [],
    nav: [],
    checklist: [],
  },
];

export function getPlugin(id: string): PluginManifest | undefined {
  return PLUGIN_MANIFESTS.find((plugin) => plugin.id === id);
}

export function listPlugins(): PluginManifest[] {
  return PLUGIN_MANIFESTS;
}

export function pluginsForProject(installs: Array<{ plugin_id: string; state: string }>): PluginManifest[] {
  const active = new Set(installs.filter((i) => i.state === 'active').map((i) => i.plugin_id));
  return PLUGIN_MANIFESTS.filter((p) => active.has(p.id));
}
