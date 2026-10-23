import type { SocialLink, SocialNetwork } from './types';

const HTTPS = /^https:\/\/[^\s]+$/i;

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: 'Facebook', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', telegram: 'Telegram', pinterest: 'Pinterest',
  github: 'GitHub', behance: 'Behance', dribbble: 'Dribbble',
};

export function socialHref(link: SocialLink): string | null {
  const value = link.url.trim();
  if (link.network === 'whatsapp') {
    const digits = value.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (!HTTPS.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return value;
  } catch {
    return null;
  }
}

export function validateSocialLinks(links: SocialLink[]): string[] {
  if (links.length > 8) return ['You can add up to 8 social links.'];
  const errors: string[] = [];
  for (const link of links) {
    if (!link.url.trim()) continue;
    if (!socialHref(link)) {
      errors.push(link.network === 'whatsapp'
        ? 'Add a WhatsApp number with the country code.'
        : `Add a web address that starts with https:// for ${SOCIAL_LABELS[link.network]}.`);
    }
  }
  return errors;
}
