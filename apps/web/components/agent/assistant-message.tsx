"use client";

import * as React from "react";

type Props = {
  text: string;
};

export const AssistantMessage = React.memo(function AssistantMessage({ text }: Props) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="prose-assistant text-[15px] leading-relaxed text-text">
      {blocks.map((block, index) => (
        <div key={index} className="mb-3 last:mb-0">
          {block.type === "heading" ? (
            <h2 className="text-base font-semibold text-text mb-1.5">
              {renderInline(block.content)}
            </h2>
          ) : block.type === "list" ? (
            <ul className="list-disc pl-5 mb-0 text-text text-[15px] leading-relaxed">
              {block.items.map((item, i) => (
                <li key={i} className="mb-1">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-0">{renderInline(block.content)}</p>
          )}
        </div>
      ))}
    </div>
  );
});

type Block =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string }
  | { type: "list"; items: string[] };

const MAX_INLINE_TOKENS = 2000;
const MAX_INLINE_DEPTH = 6;
const MAX_INLINE_LENGTH = 50_000;

function parseBlocks(text: string): Block[] {
  const rawBlocks = text.split(/\n\s*\n/);
  const blocks: Block[] = [];
  for (const raw of rawBlocks) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", content: heading[1].trim() });
      continue;
    }
    const lines = trimmed.split("\n");
    const listItems: string[] = [];
    let allList = true;
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(.+)$/);
      if (!m) {
        allList = false;
        break;
      }
      listItems.push(m[1].trim());
    }
    if (allList && listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      continue;
    }
    blocks.push({ type: "paragraph", content: trimmed });
  }
  return blocks;
}

function renderInline(content: string): React.ReactNode {
  return renderTokens(tokenizeInline(content));
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "bold"; children: Token[] }
  | { kind: "italic"; children: Token[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: Token[] };

function isSafeHref(raw: string): boolean {
  const trimmed = raw.trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(trimmed);
}

function isSpecialMarker(code: number): boolean {
  // '[' = 91, '*' = 42, '`' = 96
  return code === 91 || code === 42 || code === 96;
}

export function tokenizeInline(content: string, depth = 0): Token[] {
  if (!content) return [];
  if (depth >= MAX_INLINE_DEPTH || content.length > MAX_INLINE_LENGTH) {
    return [{ kind: "text", value: content }];
  }

  const tokens: Token[] = [];
  const len = content.length;
  let i = 0;

  while (i < len) {
    if (tokens.length >= MAX_INLINE_TOKENS) {
      tokens.push({ kind: "text", value: content.slice(i) });
      break;
    }

    const ch = content.charCodeAt(i);

    // [label](href)
    if (ch === 91) {
      const closeBracket = content.indexOf("]", i + 1);
      if (closeBracket !== -1 && content.charCodeAt(closeBracket + 1) === 40) {
        const closeParen = content.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket + 2) {
          const label = content.slice(i + 1, closeBracket);
          const href = content.slice(closeBracket + 2, closeParen).trim();
          if (href && isSafeHref(href)) {
            tokens.push({
              kind: "link",
              href,
              children: tokenizeInline(label, depth + 1),
            });
          } else {
            tokens.push({ kind: "text", value: content.slice(i, closeParen + 1) });
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    // **bold** or *italic*
    if (ch === 42) {
      if (content.charCodeAt(i + 1) === 42) {
        const closeBold = content.indexOf("**", i + 2);
        if (closeBold !== -1) {
          const inner = content.slice(i + 2, closeBold);
          tokens.push({ kind: "bold", children: tokenizeInline(inner, depth + 1) });
          i = closeBold + 2;
          continue;
        }
      } else {
        const closeItalic = content.indexOf("*", i + 1);
        if (closeItalic > i + 1 && content.charCodeAt(closeItalic + 1) !== 42) {
          const inner = content.slice(i + 1, closeItalic);
          tokens.push({ kind: "italic", children: tokenizeInline(inner, depth + 1) });
          i = closeItalic + 1;
          continue;
        }
      }
    }

    // `code`
    if (ch === 96) {
      const closeCode = content.indexOf("`", i + 1);
      if (closeCode > i + 1) {
        tokens.push({ kind: "code", value: content.slice(i + 1, closeCode) });
        i = closeCode + 1;
        continue;
      }
    }

    // Consume plain text until next potential delimiter
    let end = i + 1;
    while (end < len && !isSpecialMarker(content.charCodeAt(end))) {
      end += 1;
    }
    tokens.push({ kind: "text", value: content.slice(i, end) });
    i = end;
  }

  return tokens;
}

function renderTokens(tokens: Token[]): React.ReactNode {
  return (
    <React.Fragment>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case "text":
            return <React.Fragment key={`t-${index}`}>{token.value}</React.Fragment>;
          case "bold":
            return <strong key={`b-${index}`}>{renderTokens(token.children)}</strong>;
          case "italic":
            return <em key={`i-${index}`}>{renderTokens(token.children)}</em>;
          case "code":
            return (
              <code
                key={`c-${index}`}
                className="rounded-input border border-border bg-surface-muted px-1.5 py-0.5 text-xs font-mono text-text"
              >
                {token.value}
              </code>
            );
          case "link":
            return (
              <a
                key={`l-${index}`}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary-hover"
              >
                {renderTokens(token.children)}
              </a>
            );
        }
      })}
    </React.Fragment>
  );
}
