import type { LinkTarget } from './types';

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

export type OrderMode = 'whatsapp' | 'link' | 'email' | 'call' | 'none';

export function productOrderHref(input: {
  mode: OrderMode;
  title: string;
  price?: string;
  whatsapp?: string;
  email?: string;
  phone?: string;
  link?: LinkTarget | null;
}): string | null {
  const label = `${input.title}${input.price ? ` (${input.price})` : ''}`;
  if (input.mode === 'whatsapp') {
    const n = digits(input.whatsapp ?? '');
    if (!n) return null;
    return `https://wa.me/${n}?text=${encodeURIComponent(`Hi, I am interested in ${label}.`)}`;
  }
  if (input.mode === 'email') {
    if (!input.email) return null;
    return `mailto:${input.email}?subject=${encodeURIComponent(label)}`;
  }
  if (input.mode === 'call') {
    const n = input.phone?.replace(/[^+\d]/g, '') ?? '';
    if (!n) return null;
    return `tel:${n}`;
  }
  if (input.mode === 'link') {
    const l = input.link;
    if (!l || l.type === 'none') return null;
    if (l.type === 'url') return l.url;
    if (l.type === 'phone') return `tel:${l.number.replace(/[^+\d]/g, '')}`;
    if (l.type === 'email') return `mailto:${l.address}`;
    if (l.type === 'whatsapp') return `https://wa.me/${digits(l.number)}`;
    return null;
  }
  return null;
}
