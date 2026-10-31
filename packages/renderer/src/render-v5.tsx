import React from 'react';
import {
  compileStyles,
  richTextToPlain,
  sanitizeHtml,
  smartBlockFromNode,
  type CompiledStyles,
  type ContentNode,
  type PageContentV5,
  type RichNode,
} from '@get-on/blocks';
import { RenderBlock, type RenderContext } from './render-block';

export type RenderV5Context = RenderContext & {
  patterns?: Map<string, ContentNode>;
  getField?: (key: string) => string | null | undefined;
  compiled?: CompiledStyles;
};

const BADGE_STYLE = [
  'display:block!important',
  'visibility:visible!important',
  'opacity:1!important',
  'position:relative!important',
  'height:auto!important',
  'width:auto!important',
  'max-height:none!important',
  'max-width:960px!important',
  'margin:8px auto 0!important',
  'padding:0 20px 18px!important',
  'overflow:visible!important',
  'clip:auto!important',
  'clip-path:none!important',
  'transform:none!important',
  'filter:none!important',
  'pointer-events:auto!important',
  'font-size:12px!important',
  'line-height:1.5!important',
  'color:var(--s-muted)!important',
  'text-align:center!important',
].join(';');

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}

export function ProtectedBadge({ reportHref }: { reportHref?: string }) {
  const report = reportHref && /^\/[A-Za-z0-9/_?=&%.-]*$/.test(reportHref) ? reportHref : '/report-site';
  const html = `<div class="gs-watermark gs-protected" data-gs-protect="1" style="${BADGE_STYLE}">Built with <a href="https://get-on.tech" rel="noopener" style="color:inherit!important;text-decoration:underline!important">Get-On</a> · <a href="${escapeHtml(report)}" style="color:inherit!important;text-decoration:underline!important">Report this site</a></div>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function resolveField(key: string, ctx: RenderV5Context, fallback?: string): string {
  const value = ctx.getField?.(key);
  if (value && value.length > 0) return value;
  return fallback ?? '';
}

function markNode(node: RichNode, children: React.ReactNode, key: string, ctx: RenderV5Context): React.ReactNode {
  let out = children;
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong key={`${key}-b`}>{out}</strong>;
    else if (mark.type === 'italic') out = <em key={`${key}-i`}>{out}</em>;
    else if (mark.type === 'underline') out = <u key={`${key}-u`}>{out}</u>;
    else if (mark.type === 'strike') out = <s key={`${key}-s`}>{out}</s>;
    else if (mark.type === 'code') out = <code key={`${key}-c`}>{out}</code>;
    else if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '#';
      const target = mark.attrs?.target === '_blank' ? '_blank' : undefined;
      out = <a key={`${key}-a`} href={href} target={target} rel={target ? 'noopener noreferrer' : undefined}>{out}</a>;
    }
  }
  return out;
}

function renderRichNode(node: RichNode, key: string, ctx: RenderV5Context): React.ReactNode {
  if (node.type === 'text') return markNode(node, node.text ?? '', key, ctx);
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'horizontalRule') return <hr key={key} />;
  if (node.type === 'dynamicField') {
    const keyName = String(node.attrs?.key ?? '');
    const fallback = typeof node.attrs?.fallback === 'string' ? node.attrs.fallback : undefined;
    return <span key={key} data-gs-field={keyName}>{resolveField(keyName, ctx, fallback)}</span>;
  }
  const children = (node.content ?? []).map((child, index) => renderRichNode(child, `${key}.${index}`, ctx));
  if (node.type === 'paragraph') return <p key={key}>{children}</p>;
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    const Tag = (`h${Math.min(6, Math.max(1, level))}` as unknown) as keyof React.JSX.IntrinsicElements;
    return <Tag key={key}>{children}</Tag>;
  }
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={key} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
  if (node.type === 'listItem') return <li key={key}>{children}</li>;
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>;
  if (node.type === 'codeBlock') return <pre key={key}><code>{children}</code></pre>;
  if (node.type === 'doc') return <React.Fragment key={key}>{children}</React.Fragment>;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

function applyOverrides(node: ContentNode, overrides: Record<string, any> | undefined): ContentNode {
  if (!overrides) return node;
  const override = overrides[node.id];
  const next: ContentNode = override ? { ...node, ...override } : node;
  if (node.children) {
    return { ...next, children: node.children.map((child) => applyOverrides(child, overrides)) };
  }
  return next;
}

function classesFor(node: ContentNode, compiled?: CompiledStyles): string {
  const parts = [`gs-n-${node.id}`];
  for (const cls of compiled?.classes.get(node.id) ?? []) parts.push(cls);
  for (const cls of node.classes ?? []) parts.push(cls);
  if (node.hidden?.all) parts.push('gs-hide-all');
  if (node.hidden?.phone) parts.push('gs-hide-phone');
  if (node.hidden?.tablet) parts.push('gs-hide-tablet');
  if (node.hidden?.computer) parts.push('gs-hide-computer');
  return parts.join(' ');
}

function attrsFor(node: ContentNode, overlay: boolean): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (node.attrs?.id) attrs.id = node.attrs.id;
  if (node.attrs?.role) attrs.role = node.attrs.role;
  if (node.attrs?.ariaLabel) attrs['aria-label'] = node.attrs.ariaLabel;
  if (node.attrs?.ariaHidden != null) attrs['aria-hidden'] = node.attrs.ariaHidden;
  for (const [key, value] of Object.entries(node.attrs?.data ?? {})) attrs[`data-${key}`] = value;
  if (overlay) {
    attrs['data-gs-node'] = node.id;
    attrs['data-gs-type'] = node.type;
    if (node.locked) attrs['data-gs-locked'] = '1';
  }
  return attrs;
}

function textProps(node: ContentNode, ctx: RenderV5Context): React.ReactNode {
  const rich = node.props?.rich as RichNode | undefined;
  if (rich && typeof rich === 'object') return renderRichNode(rich, node.id, ctx);
  const text = typeof node.props?.text === 'string' ? node.props.text : '';
  return text;
}

function renderList(node: ContentNode): React.ReactNode {
  const items = Array.isArray(node.props?.items) ? (node.props?.items as unknown[]) : [];
  const Tag = node.props?.ordered === true ? 'ol' : 'ul';
  return <Tag>{items.map((item, index) => <li key={index}>{String(item)}</li>)}</Tag>;
}

function renderImage(node: ContentNode, ctx: RenderV5Context): React.ReactNode {
  const imageId = typeof node.props?.imageId === 'string' ? node.props.imageId : null;
  const image = imageId && ctx.getImage ? ctx.getImage(imageId) : null;
  if (!image) return <div className="gs-image-placeholder" aria-hidden="true" />;
  return (
    <figure>
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes="(min-width:900px) 45vw,100vw"
        width={image.width}
        height={image.height}
        alt={typeof node.props?.alt === 'string' && node.props.alt ? node.props.alt : image.alt ?? ''}
        loading="lazy"
        decoding="async"
      />
    </figure>
  );
}

function renderButton(node: ContentNode): React.ReactNode {
  const label = typeof node.props?.label === 'string' ? node.props.label : 'Learn more';
  const style = ['solid', 'outline', 'soft', 'plain'].includes(String(node.props?.style)) ? String(node.props?.style) : 'solid';
  const link = node.props?.link as { type?: string; url?: string; pageId?: string; number?: string; address?: string; anchor?: string } | undefined;
  let href: string | null = null;
  if (link?.type === 'url' && typeof link.url === 'string') href = link.url;
  else if (link?.type === 'phone' && typeof link.number === 'string') href = `tel:${link.number}`;
  else if (link?.type === 'email' && typeof link.address === 'string') href = `mailto:${link.address}`;
  else if (link?.type === 'section' && typeof link.anchor === 'string') href = `#${link.anchor}`;
  else if (link?.type === 'page' && typeof link.pageId === 'string') href = `/${link.pageId}`;
  if (!href) return <span className={`gs-btn gs-btn-${style}`}>{label}</span>;
  return <a className={`gs-btn gs-btn-${style}`} href={href}>{label}</a>;
}

export function RenderNodeV5({
  node,
  ctx,
  compiled,
  overlay = true,
  depth = 0,
  keyPrefix = '',
}: {
  node: ContentNode;
  ctx: RenderV5Context;
  compiled?: CompiledStyles;
  overlay?: boolean;
  depth?: number;
  keyPrefix?: string;
}): React.ReactNode {
  if (depth > 12) return null;
  if (node.hidden?.all) return null;
  const className = classesFor(node, compiled);
  const attrs = attrsFor(node, overlay);
  const key = keyPrefix || node.id;

  if (node.type === 'reference') {
    const patternId = String(node.props?.patternId ?? '');
    const pattern = ctx.patterns?.get(patternId);
    if (!pattern) {
      return (
        <div key={key} className={`${className} gs-missing-pattern`} {...attrs} data-gs-missing-pattern={patternId}>
          <p>This saved section is not available. It will not break the rest of the page.</p>
        </div>
      );
    }
    const content = applyOverrides(pattern, node.props?.overrides as Record<string, any> | undefined);
    return (
      <div key={key} className={className} {...attrs} data-gs-reference={patternId}>
        <RenderNodeV5 node={content} ctx={ctx} compiled={compiled} overlay={false} depth={depth + 1} keyPrefix={`${key}-ref`} />
      </div>
    );
  }

  if (node.type === 'smart') {
    const block = smartBlockFromNode(node);
    return (
      <div key={key} className={className} {...attrs}>
        <RenderBlock block={block} ctx={ctx} />
      </div>
    );
  }

  if (node.type === 'field') {
    const fieldKey = String(node.props?.key ?? '');
    const fallback = typeof node.props?.fallback === 'string' ? node.props.fallback : undefined;
    return <span key={key} className={className} {...attrs} data-gs-field={fieldKey}>{resolveField(fieldKey, ctx, fallback)}</span>;
  }

  if (node.type === 'html') {
    const result = sanitizeHtml(typeof node.props?.html === 'string' ? node.props.html : '');
    return <div key={key} className={className} {...attrs} dangerouslySetInnerHTML={{ __html: result.html }} />;
  }

  const children = (node.children ?? []).map((child, index) => (
    <RenderNodeV5
      key={child.id}
      node={child}
      ctx={ctx}
      compiled={compiled}
      overlay={overlay}
      depth={depth + 1}
      keyPrefix={`${key}.${index}`}
    />
  ));

  switch (node.type) {
    case 'page':
      return <div key={key} className={`gs-page ${className}`} {...attrs}>{children}</div>;
    case 'section':
      return <section key={key} className={`gs-section ${className}`} {...attrs}>{children}</section>;
    case 'container':
      return <div key={key} className={`gs-container ${className}`} {...attrs}>{children}</div>;
    case 'stack':
      return <div key={key} className={`gs-stack ${className}`} {...attrs}>{children}</div>;
    case 'columns':
      return <div key={key} className={`gs-columns ${className}`} {...attrs}>{children}</div>;
    case 'column':
      return <div key={key} className={`gs-column ${className}`} {...attrs}>{children}</div>;
    case 'grid':
      return <div key={key} className={`gs-grid ${className}`} {...attrs}>{children}</div>;
    case 'accordion':
      return <div key={key} className={`gs-accordion ${className}`} {...attrs}>{children}</div>;
    case 'accordion-item': {
      const title = typeof node.props?.title === 'string' ? node.props.title : 'Details';
      return (
        <details key={key} className={`gs-accordion-item ${className}`} {...attrs} open={node.props?.open === true}>
          <summary>{title}</summary>
          <div className="gs-accordion-body">{children}</div>
        </details>
      );
    }
    case 'heading': {
      const level = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(String(node.props?.level)) ? String(node.props?.level) : 'h2';
      const Tag = level as keyof React.JSX.IntrinsicElements;
      return <Tag key={key} className={className} {...attrs}>{textProps(node, ctx)}</Tag>;
    }
    case 'text':
      return <div key={key} className={`gs-text ${className}`} {...attrs}>{textProps(node, ctx)}</div>;
    case 'list':
      return <div key={key} className={className} {...attrs}>{renderList(node)}</div>;
    case 'image':
      return <div key={key} className={className} {...attrs}>{renderImage(node, ctx)}</div>;
    case 'button':
      return <div key={key} className={`gs-button-wrap ${className}`} {...attrs}>{renderButton(node)}</div>;
    case 'divider': {
      const style = ['line', 'dots', 'short'].includes(String(node.props?.style)) ? String(node.props?.style) : 'line';
      return <div key={key} className={className} {...attrs}><div className={`gs-divider gs-divider-${style}`} role="separator" /></div>;
    }
    case 'spacer': {
      const height = node.props?.height === 'small' ? 24 : node.props?.height === 'large' ? 96 : 48;
      return <div key={key} className={className} {...attrs} aria-hidden="true"><div className="gs-spacer" style={{ height }} /></div>;
    }
    case 'video': {
      const url = typeof node.props?.url === 'string' ? node.props.url : '';
      const safe = /^https?:\/\//i.test(url) ? url : null;
      return (
        <div key={key} className={`gs-video ${className}`} {...attrs}>
          {safe ? <a href={safe} rel="noopener noreferrer" target="_blank">Watch the video</a> : null}
        </div>
      );
    }
    case 'icon':
      return <div key={key} className={className} {...attrs} data-gs-icon={String(node.props?.name ?? 'star')} aria-hidden="true" />;
    case 'form':
      return <div key={key} className={`gs-form-placeholder ${className}`} {...attrs} />;
    default:
      return <div key={key} className={className} {...attrs}>{children}</div>;
  }
}

export function RenderPageV5({
  content,
  header,
  footer,
  ctx = {},
  compiled,
  protect = false,
  reportHref,
  overlay = true,
}: {
  content: PageContentV5;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  ctx?: RenderV5Context;
  compiled?: CompiledStyles;
  protect?: boolean;
  reportHref?: string;
  overlay?: boolean;
}) {
  const styles = compiled ?? compileStyles(content.root, { customCss: content.css });
  return (
    <>
      {header}
      <RenderNodeV5 node={content.root} ctx={ctx} compiled={styles} overlay={overlay} />
      {footer}
      {protect ? <ProtectedBadge reportHref={reportHref} /> : null}
    </>
  );
}

export function richTextPlain(doc: unknown): string {
  return richTextToPlain(doc as any);
}
