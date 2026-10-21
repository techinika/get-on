import * as React from "react";

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const PLACEHOLDER_PATTERN = /\[\[[^\]\n]+\]\]|\(\[[^\]\n]+\]\)|\[[^\]\n]{2,80}\](?!\()/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function highlight(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <mark
        key={`${keyPrefix}-placeholder-${match.index}`}
        className="rounded-[4px] bg-accent-soft px-1 text-accent-text"
      >
        {match[0]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function withEmails(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  EMAIL_PATTERN.lastIndex = 0;
  while ((match = EMAIL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <a
        key={`${keyPrefix}-email-${match.index}`}
        href={`mailto:${match[0]}`}
        className="text-[15px] text-primary underline underline-offset-[3px]"
      >
        {match[0]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * Renders legal copy. Links, email addresses and anything still unfinished
 * (a placeholder or a [[DECISION: ...]] marker) are handled here so the
 * content can be written as plain text.
 */
export function LegalText({ text }: { text: string }) {
  const parts = text.split(LINK_PATTERN);
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === undefined) continue;

    if (index % 3 === 1) {
      const href = parts[index + 1] ?? "";
      nodes.push(
        <a
          key={`link-${index}`}
          href={href}
          className="text-primary underline underline-offset-[3px]"
        >
          {part}
        </a>,
      );
      continue;
    }
    if (index % 3 === 2) continue;

    for (const [chunkIndex, chunk] of highlight(part, `part-${index}`).entries()) {
      if (typeof chunk === "string") {
        nodes.push(
          <React.Fragment key={`part-${index}-chunk-${chunkIndex}`}>
            {withEmails(chunk, `part-${index}-chunk-${chunkIndex}`)}
          </React.Fragment>,
        );
      } else {
        nodes.push(chunk);
      }
    }
  }

  return <>{nodes}</>;
}
