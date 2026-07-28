import React, { useRef, useCallback } from 'react';

// Plain mousedown/mousemove drag-to-resize divider — no dependency, matches
// this app's existing no-heavy-deps convention (see techPackExcel.js's
// comment on why xlsx was avoided). `width`/`onWidthChange` control the
// left pane's width in px; the right pane fills the remaining space.
export default function Splitter({ width, onWidthChange, min = 220, max = 640 }) {
  const dragging = useRef(false);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (moveEvent) => {
      if (!dragging.current) return;
      const next = Math.min(max, Math.max(min, startWidth + (moveEvent.clientX - startX)));
      onWidthChange(next);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, onWidthChange, min, max]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="splitter-handle"
      // alignSelf:stretch is load-bearing. This element has no content of its
      // own — only an absolutely-positioned bar — so under the row's default
      // align-items:flex-start it computed to ZERO height: an invisible
      // divider with no hit area, making drag-to-resize impossible. Stretching
      // to the row's height is what gives it something to fill.
      style={{ width: 10, cursor: 'col-resize', flexShrink: 0, alignSelf: 'stretch', minHeight: 40, background: 'transparent', position: 'relative' }}
      title="Drag to resize"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="splitter-bar" />
    </div>
  );
}
