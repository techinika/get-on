import React from "react";
import { RenderBlock, type RenderContext } from "./render-block";

export function RenderPage({
  content,
  header,
  footer,
  ctx,
}: {
  content: unknown;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  ctx?: RenderContext;
}) {
  const blocks =
    content && typeof content === "object" && "blocks" in content
      ? ((content as { blocks?: unknown[] }).blocks ?? [])
      : [];
  return (
    <div>
      {header}
      {blocks.map((block, index) => (
        <RenderBlock key={index} block={block} ctx={ctx} />
      ))}
      {footer}
    </div>
  );
}
