import React from 'react';
import { RenderBlock } from './render-block';

export function RenderPage({
  content,
  header,
  footer,
}: {
  content: any;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
  return (
    <div>
      {header}
      {blocks.map((block: any) => (
        <RenderBlock key={block.id} block={block} />
      ))}
      {footer}
    </div>
  );
}
