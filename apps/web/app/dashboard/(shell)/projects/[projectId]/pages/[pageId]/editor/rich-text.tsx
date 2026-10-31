"use client";

import * as React from "react";
import { Link as LinkIcon, Bold, Italic, List, ListOrdered, Quote, Undo2 } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { richTextFromPlain, sanitizeRichText, type ContentNode } from "@get-on/blocks";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/editor/v5-store";

export function RichTextEditor({ node, compact = false }: { node: ContentNode; compact?: boolean }) {
  const updateProps = useEditorStore((state) => state.updateProps);
  const [initial] = React.useState(
    () => (node.props?.rich as object | undefined) ?? richTextFromPlain(String(node.props?.text ?? "")),
  );
  const lastEmitted = React.useRef(JSON.stringify(initial));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"] }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        class: cn(
          "prose-editor min-h-20 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary",
          compact && "min-h-10",
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      const result = sanitizeRichText(current.getJSON());
      if (!result.ok) return;
      lastEmitted.current = JSON.stringify(result.doc);
      updateProps(node.id, { rich: result.doc, text: result.text }, { group: `text:${node.id}` });
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const next = (node.props?.rich as object | undefined) ?? richTextFromPlain(String(node.props?.text ?? ""));
    const serialized = JSON.stringify(next);
    if (serialized === lastEmitted.current) return;
    lastEmitted.current = serialized;
    editor.commands.setContent(next, false);
  }, [editor, node.props?.rich, node.props?.text]);

  if (!editor) return <div className="h-20 rounded-input border border-border bg-surface-muted" />;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolButton>
        <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolButton>
        <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolButton>
        <ToolButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const href = window.prompt("Link address", previous ?? "https://");
            if (href === null) return;
            if (!href.trim()) editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: href.trim() }).run();
          }}
        >
          <LinkIcon size={15} />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-input border text-text",
        active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

export function InlineHint() {
  return (
    <p className="flex items-center gap-1 text-xs text-text-muted">
      <Undo2 size={12} aria-hidden /> Every change can be undone.
    </p>
  );
}
