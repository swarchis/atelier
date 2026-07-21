import React from 'react';

/* The flat brand mark: a serif A whose crossbar is a needle, its eye
   punched through the right end. (Swap here if a bitmap master lands in
   public/brand/.)

   Lives in its own module — separate from IntroGate — so the header brand
   mark can be imported without pulling three.js into the initial bundle.
   IntroGate is lazy-loaded; this stays synchronous. */

const SERIF = "'Newsreader', Georgia, serif";

export function NeedleA({ size = 26, color = '#F4F2EC', className, style, preserveAspectRatio = 'xMidYMid meet' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" aria-hidden
      preserveAspectRatio={preserveAspectRatio}
      className={className} style={{ display: 'block', overflow: 'visible', ...style }}
    >
      <text x="44" y="78" textAnchor="middle" fontFamily={SERIF} fontSize="88" fontWeight="500" fill={color}>A</text>
      <path d="M18 57 H70" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M70 57 C77 50.5 92 50.5 92 57 C92 63.5 77 63.5 70 57 Z" fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

export default NeedleA;
