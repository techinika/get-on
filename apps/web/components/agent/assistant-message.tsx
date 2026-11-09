"use client";

import * as React from "react";

type Props = {
  text: string;
};

export function AssistantMessage({ text }: Props) {
  const blocks = parseBlocks(text);
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
}

type Block =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string }
  | { type: "list"; items: string[] };

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
      if (!m) { allList = false; break; }
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

function tokenizeInline(content: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < content.length) {
    const rest = content.slice(i);
    const link = rest.match(/^\[([^\]]*?)\]\(([^)]+?)\)/);
    if (link) {
      tokens.push({ kind: "link", href: link[2], children: tokenizeInline(link[1]) });
      i += link[0].length;
      continue;
    }
    const bold = rest.match(/^\*\*([\s\S]*?)\*\*/);
    if (bold) {
      tokens.push({ kind: "bold", children: tokenizeInline(bold[1]) });
      i += bold[0].length;
      continue;
    }
    const italic = rest.match(/^\*([^\*]+?)\*(?!\*)/);
    if (italic) {
      tokens.push({ kind: "italic", children: tokenizeInline(italic[1]) });
      i += italic[0].length;
      continue;
    }
    const code = rest.match(/^`([^`]+?)`/);
    if (code) {
      tokens.push({ kind: "code", value: code[1] });
      i += code[0].length;
      continue;
    }
    const next = rest.search(/[\[*(`]/);
    const chunk = next === -1 ? rest : rest.slice(0, next);
    tokens.push({ kind: "text", value: chunk });
    i += chunk.length;
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
              <code key={`c-${index}`} className="rounded-input border border-border bg-surface-muted px-1.5 py-0.5 text-xs font-mono text-text">
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
