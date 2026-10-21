import React from 'react';
import { blockSchema } from '@get-on/blocks';

export function RenderBlock({ block }: { block: any }) {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) {
    return null;
  }
  const b = parsed.data as any;
  const bg = b.props?.background || 'plain';
  const bgClass =
    bg === 'soft' ? 'gs-section-bg-soft' : bg === 'brand' ? 'gs-section-bg-brand' : '';

  if (b.type === 'spacer') {
    const h = b.props?.height === 'small' ? 24 : b.props?.height === 'large' ? 96 : 48;
    return <div className="gs-spacer" style={{ height: h }} aria-hidden />;
  }
  if (b.type === 'divider') {
    return <div className="gs-divider" role="separator" />;
  }
  if (b.type === 'contact-form') {
    return null; // not functional yet
  }

  return (
    <section className={`gs-section ${bgClass}`}>
      <div className="gs-inner">
        {b.type === 'heading' && <h2 className="gs-h2">{b.props?.text}</h2>}
        {b.type === 'text' && <p className="gs-p">{typeof b.props?.content === 'string' ? b.props.content : ''}</p>}
        {b.type === 'button' && b.props?.label ? (
          <div className="gs-btn-wrap">
            <button className="gs-btn gs-btn-solid">{b.props.label}</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
