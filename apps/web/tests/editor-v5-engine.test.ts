import { describe, expect, it } from 'vitest';
import {
  compileStyles,
  createNode,
  migrateV4ToV5,
  pageFromBlocks,
  sanitizeCustomCss,
  sanitizeHtml,
  sanitizeRichText,
  validateContentV5,
  type PageContentV5,
} from '@get-on/blocks';

function validPage(): PageContentV5 {
  return pageFromBlocks([
    { id: 'hero-block-1', type: 'hero', props: { heading: 'Hello', subheading: 'World' } },
    { id: 'text-block-01', type: 'text', props: { text: 'About us' }, sec: { anchor: 'about' } },
  ]);
}

describe('v5 migration', () => {
  it('turns v4 blocks into smart nodes without losing props', () => {
    const page = migrateV4ToV5({
      schemaVersion: 4,
      blocks: [
        { id: 'hero-block-1', type: 'hero', props: { heading: 'Hello' } },
        { id: 'text-block-01', type: 'text', props: { text: 'About us' }, sec: { anchor: 'about' } },
      ],
    });
    expect(page.schemaVersion).toBe(5);
    expect(page.root.children).toHaveLength(2);
    expect(page.root.children?.[0]).toMatchObject({ type: 'smart', props: { kind: 'hero', heading: 'Hello' } });
    expect(page.root.children?.[1]?.attrs?.id).toBe('about');
    expect(page.meta?.migratedFrom).toBe(4);
  });

  it('is idempotent', () => {
    const first = migrateV4ToV5(validPage());
    const second = migrateV4ToV5(first);
    expect(second).toBe(first);
  });

  it('migrates shared blocks to references', () => {
    const page = migrateV4ToV5({
      schemaVersion: 4,
      blocks: [{ id: 'shared-block-1', type: 'shared', props: { sharedId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }],
    });
    expect(page.root.children?.[0]).toMatchObject({ type: 'reference', props: { patternId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
  });

  it('marks blocks that need the contact plugin', () => {
    const page = migrateV4ToV5({ schemaVersion: 4, blocks: [{ id: 'contact-form-1', type: 'contact-form', props: {} }] });
    expect(page.root.children?.[0]?.requiresPlugin).toBe('contact');
  });

  it('makes duplicate anchors unique', () => {
    const page = migrateV4ToV5({
      schemaVersion: 4,
      blocks: [
        { id: 'block-one-01', type: 'text', props: { text: 'A' }, sec: { anchor: 'about' } },
        { id: 'block-two-02', type: 'text', props: { text: 'B' }, sec: { anchor: 'about' } },
      ],
    });
    expect(page.root.children?.map((node) => node.attrs?.id)).toEqual(['about', 'about-2']);
  });
});

describe('v5 validation', () => {
  it('accepts a valid page', () => {
    const result = validateContentV5(validPage());
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const page = validPage();
    page.root.children![1].id = page.root.children![0].id;
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'id.duplicate')).toBe(true);
  });

  it('rejects children on a leaf', () => {
    const page = validPage();
    page.root.children![0].children = [createNode('text')];
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
  });

  it('rejects a column outside columns', () => {
    const page = validPage();
    page.root.children = [createNode('column')];
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown smart sections', () => {
    const page = validPage();
    page.root.children = [{ id: 'n_unknown1', type: 'smart', props: { kind: 'not-a-block' } }];
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing plugin when plugins are supplied', () => {
    const page = migrateV4ToV5({ schemaVersion: 4, blocks: [{ id: 'contact-form-1', type: 'contact-form', props: {} }] });
    const result = validateContentV5(page, { enabledPlugins: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'plugin.missing')).toBe(true);
  });

  it('sanitises html and rejects scripts', () => {
    const page = validPage();
    page.root.children = [{ id: 'n_html00001', type: 'html', props: { html: '<p onclick="x()">Hi<script>alert(1)</script></p>' } }];
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'html')).toBe(true);
    const sanitized = sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script></p>');
    expect(sanitized.html).toContain('Hi');
    expect(sanitized.html).not.toContain('script');
    expect(sanitized.html).not.toContain('onclick');
  });

  it('sanitises rich text marks and links', () => {
    const result = sanitizeRichText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown style properties', () => {
    const page = validPage();
    page.root.children![0].styles = { base: { 'background-image': 'url(https://evil.example/x.png)' } };
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
  });

  it('rejects custom classes that pretend to be protected', () => {
    const page = validPage();
    page.root.children![0].classes = ['gs-watermark'];
    const result = validateContentV5(page);
    expect(result.ok).toBe(false);
  });
});

describe('style compiler', () => {
  it('dedupes identical styles and emits cascade layers', () => {
    const page = validPage();
    page.root.children![0].styles = { base: { color: '{text}', 'padding-top': '12px' } };
    page.root.children![1].styles = { base: { color: '{text}', 'padding-top': '12px' } };
    const compiled = compileStyles(page.root);
    expect(compiled.css.startsWith('@layer gs-protect, gs-base, gs-theme, gs-nodes, gs-user;')).toBe(true);
    const matches = compiled.css.match(/\.gs-s-[0-9a-f]{8}\{/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(compiled.classes.get(page.root.children![0].id)).toEqual(compiled.classes.get(page.root.children![1].id));
  });

  it('emits tablet and phone rules as container queries', () => {
    const page = validPage();
    page.root.children![0].styles = { tablet: { padding: '8px' }, phone: { padding: '4px' } };
    const compiled = compileStyles(page.root);
    expect(compiled.css).toContain('@container site (max-width:899px)');
    expect(compiled.css).toContain('@container site (max-width:639px)');
  });

  it('applies custom css inside the user layer', () => {
    const page = validPage();
    const compiled = compileStyles(page.root, { customCss: '.card { color: red; }' });
    expect(compiled.css).toContain('@layer gs-user{');
    expect(compiled.css).toContain('.gs-root .card');
  });
});

describe('custom css sandbox', () => {
  it('scopes selectors to the site root', () => {
    const result = sanitizeCustomCss('.card, :root { color: red; }');
    expect(result.ok).toBe(true);
    expect(result.css).toContain('.gs-root .card');
    expect(result.css).toContain('.gs-root{color:red}');
  });

  it('rejects !important', () => {
    const result = sanitizeCustomCss('.card { display: none !important; }');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('!important');
  });

  it('rejects protected selectors and universal selectors', () => {
    expect(sanitizeCustomCss('.gs-watermark { display: none; }').ok).toBe(false);
    expect(sanitizeCustomCss('* { display: none; }').ok).toBe(false);
    expect(sanitizeCustomCss('[data-gs-protect] { display: none; }').ok).toBe(false);
  });

  it('rejects imports and font faces', () => {
    expect(sanitizeCustomCss('@import url(https://evil.example/x.css);').ok).toBe(false);
    expect(sanitizeCustomCss('@font-face { font-family: X; src: url(https://evil.example/x.woff); }').ok).toBe(false);
  });

  it('rewrites fixed positioning to sticky', () => {
    const result = sanitizeCustomCss('.card { position: fixed; top: 0; }');
    expect(result.ok).toBe(true);
    expect(result.css).toContain('position:sticky');
  });

  it('rejects external images', () => {
    expect(sanitizeCustomCss('.card { background-image: url(https://evil.example/x.png); }').ok).toBe(false);
    expect(sanitizeCustomCss('.card { background-image: url(/assets/x.png); }').ok).toBe(true);
  });
});

describe('html sanitiser', () => {
  it('drops dangerous tags and attributes', () => {
    const result = sanitizeHtml('<div><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)" onclick="x()">Hi</a></div>');
    expect(result.ok).toBe(false);
    expect(result.html).not.toContain('iframe');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('onclick');
    expect(result.html).toContain('Hi');
  });

  it('keeps safe links and pictures', () => {
    const result = sanitizeHtml('<p><a href="https://example.com">Hi</a><img src="/assets/a.png" alt="A"></p>');
    expect(result.ok).toBe(true);
    expect(result.html).toContain('https://example.com');
    expect(result.html).toContain('/assets/a.png');
  });
});
