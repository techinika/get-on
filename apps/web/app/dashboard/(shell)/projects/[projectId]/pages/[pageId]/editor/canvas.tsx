"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  RENDERER_CSS,
  RenderPageV5,
  SiteFooter,
  SiteHeader,
  SiteRoot,
  type RenderImage,
} from "@get-on/renderer";
import {
  compileStyles,
  findNode,
  findParent,
  richTextFromPlain,
  type PageContentV5,
  type Theme,
} from "@get-on/blocks";
import { ArrowDown, ArrowUp, Copy, CornerLeftUp, GripVertical, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/editor/v5-store";

export type CanvasBusiness = {
  name: string;
  tagline?: string;
  businessType?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  socialLinks?: { network: string; url: string }[];
};

const EDITOR_CSS = `
html,body{margin:0;padding:0;background:transparent}
body{min-height:100vh}
.gs-editor-selected{outline:2px solid #0b6b4f!important;outline-offset:-2px}
.gs-editor-hover{outline:1px dashed rgba(11,107,79,.6)!important;outline-offset:-1px}
[contenteditable="true"]{outline:2px solid #f5a524!important;outline-offset:-2px;cursor:text}
`;

const FRAME_DOC = `<!doctype html><html lang="en" data-color-mode="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0}</style></head><body><div id="gs-editor-root"></div></body></html>`;

export function EditorCanvas({
  content,
  theme,
  business,
  media,
  nav,
  protect,
  reportHref,
}: {
  content: PageContentV5;
  theme: Theme;
  business: CanvasBusiness;
  media: Array<[string, RenderImage]>;
  nav: { label: string; href: string; pageId: string }[];
  protect: boolean;
  reportHref: string;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [doc, setDoc] = React.useState<Document | null>(null);
  const [mount, setMount] = React.useState<HTMLElement | null>(null);
  const [areaWidth, setAreaWidth] = React.useState(900);
  const [frameHeight, setFrameHeight] = React.useState(800);

  const selectedId = useEditorStore((state) => state.selectedId);
  const hoveredId = useEditorStore((state) => state.hoveredId);
  const mode = useEditorStore((state) => state.mode);
  const width = useEditorStore((state) => state.width);
  const zoom = useEditorStore((state) => state.zoom);
  const select = useEditorStore((state) => state.select);
  const hover = useEditorStore((state) => state.hover);
  const setEditing = useEditorStore((state) => state.setEditing);
  const updateProps = useEditorStore((state) => state.updateProps);
  const moveSibling = useEditorStore((state) => state.moveSibling);
  const duplicate = useEditorStore((state) => state.duplicate);
  const remove = useEditorStore((state) => state.remove);

  const images = React.useMemo(() => new Map(media), [media]);
  const compiled = React.useMemo(() => compileStyles(content.root, { customCss: content.css }), [content]);

  React.useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setAreaWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const onLoad = () => {
      const nextDoc = frame.contentDocument;
      if (!nextDoc) return;
      setDoc(nextDoc);
      let root = nextDoc.getElementById("gs-editor-root");
      if (!root) {
        root = nextDoc.createElement("div");
        root.id = "gs-editor-root";
        nextDoc.body.appendChild(root);
      }
      setMount(root);
    };
    frame.addEventListener("load", onLoad);
    if (frame.contentDocument?.readyState === "complete") onLoad();
    return () => frame.removeEventListener("load", onLoad);
  }, []);

  React.useEffect(() => {
    if (!doc) return;
    let style = doc.getElementById("gs-editor-styles");
    if (!style) {
      style = doc.createElement("style");
      style.id = "gs-editor-styles";
      doc.head.appendChild(style);
    }
    style.textContent = `@layer gs-protect,gs-base,gs-theme,gs-nodes,gs-user;@layer gs-base{${RENDERER_CSS}}${compiled.css}${EDITOR_CSS}`;
  }, [doc, compiled, theme]);

  React.useEffect(() => {
    if (!doc) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const node = target?.closest?.("[data-gs-node]");
      if (!node) return;
      event.preventDefault();
      event.stopPropagation();
      if (mode === "preview") return;
      select(node.getAttribute("data-gs-node"));
    };
    const onMove = (event: MouseEvent) => {
      if (mode === "preview") return;
      const target = event.target as Element | null;
      const node = target?.closest?.("[data-gs-node]");
      hover(node?.getAttribute("data-gs-node") ?? null);
    };
    const onLeave = () => hover(null);
    const onDoubleClick = (event: MouseEvent) => {
      if (mode === "preview") return;
      const target = event.target as Element | null;
      const node = target?.closest?.("[data-gs-node]");
      const id = node?.getAttribute("data-gs-node");
      if (!id) return;
      const found = findNode(content.root, id);
      if (!found || (found.type !== "heading" && found.type !== "text")) return;
      event.preventDefault();
      const element = node as HTMLElement;
      element.setAttribute("contenteditable", "true");
      element.focus();
      const range = doc.createRange();
      range.selectNodeContents(element);
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setEditing(id);
    };
    const onBlur = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.hasAttribute("contenteditable")) return;
      const id = target.getAttribute("data-gs-node");
      target.removeAttribute("contenteditable");
      if (!id) return;
      const text = target.textContent ?? "";
      const found = findNode(content.root, id);
      if (found && found.props?.text !== text) {
        updateProps(id, found.props?.rich ? { text, rich: richTextFromPlain(text) } : { text });
      }
      setEditing(null);
    };

    doc.addEventListener("click", onClick, true);
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseleave", onLeave);
    doc.addEventListener("dblclick", onDoubleClick, true);
    doc.addEventListener("blur", onBlur, true);
    return () => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseleave", onLeave);
      doc.removeEventListener("dblclick", onDoubleClick, true);
      doc.removeEventListener("blur", onBlur, true);
    };
  }, [doc, content, mode, select, hover, setEditing, updateProps]);

  React.useEffect(() => {
    if (!doc) return;
    for (const element of Array.from(doc.querySelectorAll(".gs-editor-selected,.gs-editor-hover"))) {
      element.classList.remove("gs-editor-selected", "gs-editor-hover");
    }
    const selected = selectedId ? doc.querySelector(`[data-gs-node="${CSS.escape(selectedId)}"]`) : null;
    if (selected && mode === "edit") selected.classList.add("gs-editor-selected");
    const hovered = hoveredId && hoveredId !== selectedId ? doc.querySelector(`[data-gs-node="${CSS.escape(hoveredId)}"]`) : null;
    if (hovered && mode === "edit") hovered.classList.add("gs-editor-hover");
  }, [doc, selectedId, hoveredId, mode]);

  React.useEffect(() => {
    if (!doc) return;
    const body = doc.body;
    if (!body) return;
    const observer = new ResizeObserver(() => setFrameHeight(Math.max(320, body.scrollHeight)));
    observer.observe(body);
    return () => observer.disconnect();
  }, [doc, content, width]);

  const scale = zoom === "fit" ? Math.min(1, Math.max(0.25, (areaWidth - 48) / width)) : zoom / 100;
  const [toolbar, setToolbar] = React.useState<{ left: number; top: number; width: number } | null>(null);

  React.useEffect(() => {
    if (!doc) return;
    const update = () => {
      if (!selectedId || selectedId === content.root.id || mode !== "edit") {
        setToolbar(null);
        return;
      }
      const element = doc.querySelector(`[data-gs-node="${CSS.escape(selectedId)}"]`);
      const area = areaRef.current;
      const frame = iframeRef.current;
      if (!element || !area || !frame) {
        setToolbar(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setToolbar({
        left: Math.max(8, frameRect.left - areaRect.left + rect.left * scale),
        top: Math.max(8, frameRect.top - areaRect.top + rect.top * scale - 44),
        width: rect.width * scale,
      });
    };
    update();
    const area = areaRef.current;
    area?.addEventListener("scroll", update, { passive: true });
    doc.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      area?.removeEventListener("scroll", update);
      doc.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [doc, selectedId, content, mode, scale, frameHeight]);

  const parent = selectedId ? findParent(content.root, selectedId) : null;

  const header = (
    <SiteHeader
      businessName={business.name}
      logoUrl={null}
      nav={nav.map(({ label, href }) => ({ label, href }))}
      watermark={false}
      theme={theme}
      tagline={business.tagline}
      businessType={business.businessType}
      phone={business.phone}
    />
  );
  const footer = (
    <SiteFooter
      businessName={business.name}
      phone={business.phone}
      email={business.email}
      address={business.address}
      hours={business.hours}
      nav={nav.map(({ label, href }) => ({ label, href }))}
      showWatermark={false}
      theme={theme}
      tagline={business.tagline}
      socialLinks={business.socialLinks}
    />
  );

  return (
    <div
      ref={areaRef}
      className="relative flex-1 overflow-auto"
      style={{
        backgroundImage:
          "radial-gradient(circle, color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        padding: 24,
      }}
    >
      <div className="mx-auto" style={{ width: width * scale }}>
        <div
          className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
          style={{ width: width * scale, height: frameHeight * scale }}
        >
          <iframe
            ref={iframeRef}
            title="Page canvas"
            srcDoc={FRAME_DOC}
            style={{
              width,
              height: frameHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
              display: "block",
            }}
          />
        </div>
      </div>
      {doc && mount
        ? createPortal(
            <SiteRoot theme={theme}>
              <RenderPageV5
                content={content}
                header={header}
                footer={footer}
                overlay={mode === "edit"}
                protect={protect}
                reportHref={reportHref}
                ctx={{
                  mode: "editor",
                  contactEnabled: false,
                  theme,
                  hours: business.hours,
                  address: business.address,
                  phone: business.phone,
                  email: business.email,
                  socialLinks: business.socialLinks,
                  getImage: (id) => images.get(id) ?? null,
                  getPageHref: (pageId) => nav.find((item) => item.pageId === pageId)?.href ?? "/",
                  getField: (key) =>
                    ({
                      "business.name": business.name,
                      "business.tagline": business.tagline,
                      "business.type": business.businessType,
                      "contact.phone": business.phone,
                      "contact.email": business.email,
                      "contact.address": business.address,
                      "contact.hours": business.hours,
                    })[key] ?? null,
                }}
              />
            </SiteRoot>,
            mount,
          )
        : null}
      {content.root.children?.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-md rounded-card border border-border bg-surface p-6 text-center shadow-card">
            <h2 className="text-h2">Start your page</h2>
            <p className="mt-2 text-sm text-text-muted">
              Add elements and sections from the left, or let AI write the page.
            </p>
          </div>
        </div>
      ) : null}
      {toolbar && mode === "edit" && selectedId ? (
        <div
          className="absolute z-20 flex h-10 items-center gap-0.5 rounded-[10px] border border-border bg-surface p-1 shadow-card"
          style={{ left: toolbar.left, top: toolbar.top }}
          role="toolbar"
          aria-label="Selected element actions"
        >
          <span className="flex h-8 w-6 items-center justify-center text-text-muted" aria-hidden>
            <GripVertical size={16} />
          </span>
          <ToolbarButton label="Move up" onClick={() => moveSibling(selectedId, -1)}>
            <ArrowUp size={16} />
          </ToolbarButton>
          <ToolbarButton label="Move down" onClick={() => moveSibling(selectedId, 1)}>
            <ArrowDown size={16} />
          </ToolbarButton>
          {parent ? (
            <ToolbarButton label="Select parent" onClick={() => select(parent.parent.id)}>
              <CornerLeftUp size={16} />
            </ToolbarButton>
          ) : null}
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton label="Duplicate" onClick={() => duplicate(selectedId)}>
            <Copy size={16} />
          </ToolbarButton>
          <ToolbarButton label="Delete" onClick={() => remove(selectedId)}>
            <Trash2 size={16} />
          </ToolbarButton>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
