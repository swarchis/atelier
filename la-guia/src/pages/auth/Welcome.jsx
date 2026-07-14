import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { STAGES } from '../../data/mockData.js';
import { PLANS } from '../../data/plans.js';

/* ───────────────────────────────────────────────────────────────────────────
   "Draft Sheet" — the Atelier landing page built as a technical tech-pack drawing.

   A deliberate break from the previous warm-cream / serif / terracotta hero.
   The subject here is a *production* tool — its native artifact is the tech
   pack: a precise flat sketch covered in dimension callouts, grade rules, and a
   title block. So the page is built like one. Cool drafting-bone paper,
   near-black ink, and the petrol blue already living in the app's favicon
   (#2F5D7C) as the single accent. The recurring mark is the grainline symbol —
   the arrow a pattern-maker draws to align a piece with the fabric's grain,
   a real fixture of any atelier's cutting table — used as the structural
   device, plus a garment flat that draws itself with animated dimension callouts.

   Palette + type are hardcoded here (not the app's theme vars) so the page
   renders identically regardless of light/dark app state on the auth route.
─────────────────────────────────────────────────────────────────────────── */

const C = {
  sheet: '#E7E8E2',
  sheet2: '#EFF0EB',
  panel: '#F4F4EF',
  ink: '#15171B',
  ink2: '#565B63',
  ink3: '#8A8F96',
  line: '#CDCFC8',
  line2: '#B7BAB1',
  blue: '#2F5D7C',
  blueDeep: '#20455E',
  chalk: '#BF3F2E',
  cream: '#E9EAE4',
};
const DISPLAY = "'Archivo', system-ui, sans-serif";
const MONO = "'Space Mono', ui-monospace, monospace";
const BODY = "'Inter', system-ui, sans-serif";

const FEATURES = [
  { n: '01', title: 'AI Design Studio', text: 'Sketch, upload a reference, or generate a starting silhouette — then edit it on the canvas: recolor, swap fabric, build a mockup.' },
  { n: '02', title: 'Tech-Pack Builder', text: 'AI drafts the BOM, measurements, construction, trims, and labels from a short questionnaire — with a live factory-readiness score.' },
  { n: '03', title: 'Product Management', text: 'Real categories, colorway × size SKU matrices, duplicate and archive flows, and an audit trail of every stage a product has moved through.' },
  { n: '04', title: 'Vendor Platform', text: 'Search real manufacturers by material, MOQ, target price, location, and certifications. Compare up to five side by side.' },
  { n: '05', title: 'RFQ & Quote Economics', text: 'One request to many vendors. A cost breakdown, a landed-cost calculator, and a cost simulator that prices each change like a car configurator.' },
  { n: '06', title: 'Sampling', text: 'Rounds that keep their own history, photos you can pin notes onto at the exact spot, structured fit feedback, and an approval workflow.' },
  { n: '07', title: 'Production Tracking', text: 'A manufacturing timeline, an editable QC checklist, an issue log, shipment tracking, and an honest delivery estimate.' },
  { n: '08', title: 'Team & AI Assistant', text: 'Group chats with your team plus a personal assistant grounded in your own brand data — one button, on every page.' },
];

const CALLOUTS = [
  { at: [200, 118], to: [372, 120], n: '01', label: 'AI drafts the tech pack' },
  { at: [206, 200], to: [372, 196], n: '02', label: 'Readiness scored 0–100' },
  { at: [262, 250], to: [372, 272], n: '03', label: 'Sourced & quoted' },
  { at: [200, 372], to: [372, 348], n: '04', label: 'Sampled → shipped' },
];

/* The grainline symbol: a directional line capped with an arrowhead at each
   end — exactly the mark a pattern-maker draws to align a piece with the grain
   of the fabric. It is the brand's namesake, so it earns its place as the
   recurring structural device rather than a decorative icon. */
function Grainline({ h = 34, color = C.blue, stroke = 2 }) {
  const w = h * 0.36;
  return (
    <svg width={w} height={h} viewBox="0 0 18 50" fill="none" style={{ display: 'block' }} aria-hidden>
      <path d="M9 6 V44 M3 12 L9 4 L15 12 M3 38 L9 46 L15 38" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CornerMarks({ color = C.line2 }) {
  const L = ({ style }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', ...style }} aria-hidden>
      <path d="M1 1 H16 M1 1 V16" stroke={color} strokeWidth="1.25" />
    </svg>
  );
  return (
    <>
      <L style={{ top: 10, left: 10 }} />
      <L style={{ top: 10, right: 10, transform: 'scaleX(-1)' }} />
      <L style={{ bottom: 10, left: 10, transform: 'scaleY(-1)' }} />
      <L style={{ bottom: 10, right: 10, transform: 'scale(-1)' }} />
    </>
  );
}

/* The hero: one self-contained SVG "drawing sheet" — frame, registration
   marks, a faint grid, an adapted scanner beam, a crewneck flat that draws
   itself, the grainline mark placed on the body, dimension callouts, and a
   title block. Everything lives in one viewBox so it scales cleanly. */
function DraftPanel() {
  const reduce = useReducedMotion();
  const draw = reduce
    ? { initial: { pathLength: 1 }, animate: { pathLength: 1 } }
    : { initial: { pathLength: 0 }, animate: { pathLength: 1 } };
  const drawT = (d = 0) => ({ duration: 1.5, ease: 'easeInOut', delay: d });
  const calloutBase = reduce ? 0 : 1.5;

  return (
    <svg viewBox="0 0 600 560" width="100%" style={{ display: 'block' }} role="img" aria-label="Technical flat sketch of a crewneck with dimension callouts">
      <defs>
        <pattern id="grid20" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 H0 V20" fill="none" stroke={C.line} strokeWidth="0.75" opacity="0.7" />
        </pattern>
        {/* Scanner beam — adapted from 21st.dev "Background Grid Beam", recolored
            from its cyan/violet default to the petrol blueprint accent and
            slowed to read as a drafting scanner rather than a neon sweep. */}
        <motion.linearGradient
          id="beam"
          variants={{ initial: { x1: '0%', x2: '8%', y1: '-30%', y2: '-14%' }, animate: { x1: '30%', x2: '42%', y1: '120%', y2: '138%' } }}
          initial="initial"
          animate={reduce ? 'initial' : 'animate'}
          transition={{ duration: 3.2, repeat: reduce ? 0 : Infinity, repeatType: 'loop', ease: 'linear', repeatDelay: 1.6 }}
        >
          <stop stopColor={C.blue} stopOpacity="0" />
          <stop offset="0.5" stopColor={C.blue} stopOpacity="0.9" />
          <stop offset="1" stopColor={C.blue} stopOpacity="0" />
        </motion.linearGradient>
        <clipPath id="panelClip"><rect x="24" y="24" width="552" height="512" /></clipPath>
      </defs>

      {/* sheet + frame */}
      <rect x="0" y="0" width="600" height="560" fill={C.panel} />
      <rect x="24" y="24" width="552" height="512" fill="url(#grid20)" />
      <rect x="24" y="24" width="552" height="512" fill="none" stroke={C.line2} strokeWidth="1.25" />

      {/* beam traces along a few grid lines */}
      <g clipPath="url(#panelClip)" opacity="0.9">
        <path d="M24 84 H576 M24 464 H576 M120 24 V536 M480 24 V536" stroke="url(#beam)" strokeWidth="2" fill="none" />
      </g>

      {/* registration crosshairs */}
      {[[60, 60], [540, 60], [60, 500], [540, 500]].map(([x, y], i) => (
        <path key={i} d={`M${x - 7} ${y} H${x + 7} M${x} ${y - 7} V${y + 7}`} stroke={C.line2} strokeWidth="1" />
      ))}

      {/* ── the garment flat (crewneck), drawn left-of-center ─────────────── */}
      <g transform="translate(40,64)" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <motion.path {...draw} transition={drawT(0.2)}
          d="M130 46 L98 54 L44 150 L60 166 L112 92 L118 300 L202 300 L208 92 L260 166 L276 150 L222 54 L190 46 Q160 62 130 46 Z" />
        {/* neck rib, hem rib, cuffs */}
        <motion.path {...draw} transition={drawT(1.0)} stroke={C.ink2} strokeWidth="1.6"
          d="M133 51 Q160 65 187 51 M118 291 L202 291 M46 152 L60 165 M51 147 L64 160 M274 152 L260 165 M269 147 L256 160" />
        {/* center-front seam, dashed */}
        <motion.path {...draw} transition={drawT(1.1)} stroke={C.ink3} strokeWidth="1.2" strokeDasharray="2 5"
          d="M160 66 L160 300" />
        {/* grainline mark, on-body, in accent */}
        <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: calloutBase - 0.2, duration: 0.4 }}
          stroke={C.blue} strokeWidth="2"
          d="M160 150 V236 M154 158 L160 148 L166 158 M154 228 L160 238 L166 228" />
      </g>

      {/* ── dimension callouts ────────────────────────────────────────────── */}
      {CALLOUTS.map((c, i) => (
        <motion.g key={c.n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: calloutBase + i * 0.18, duration: 0.5 }}>
          <circle cx={c.at[0]} cy={c.at[1]} r="3" fill={C.blue} />
          <path d={`M${c.at[0]} ${c.at[1]} L${c.to[0] - 26} ${c.at[1]} L${c.to[0]} ${c.to[1]}`} stroke={C.blue} strokeWidth="1" fill="none" />
          <text x={c.to[0] + 6} y={c.to[1] - 5} fontFamily={MONO} fontSize="12" fontWeight="700" fill={C.blue}>{c.n}</text>
          <text x={c.to[0] + 6} y={c.to[1] + 12} fontFamily={MONO} fontSize="12.5" fill={C.ink}>{c.label}</text>
        </motion.g>
      ))}

      {/* ── title block ───────────────────────────────────────────────────── */}
      <g fontFamily={MONO} fill={C.ink2}>
        <path d={`M24 494 H576 M180 494 V536 M372 494 V536 M474 494 V536`} stroke={C.line2} strokeWidth="1.25" />
        <text x="36" y="514" fontSize="11" letterSpacing="1.5" fill={C.ink} fontWeight="700">ATELIER</text>
        <text x="36" y="528" fontSize="9.5" fill={C.ink3}>PRODUCTION OS</text>
        <text x="192" y="514" fontSize="10.5">FLAT 001 · CREWNECK</text>
        <text x="192" y="528" fontSize="9.5" fill={C.ink3}>FRONT · GRADE M</text>
        <text x="384" y="514" fontSize="10.5">SCALE 1:4</text>
        <text x="384" y="528" fontSize="9.5" fill={C.ink3}>UNIT CM</text>
        <text x="486" y="514" fontSize="10.5">REV 2.1</text>
        <text x="486" y="528" fontSize="9.5" fill={C.ink3}>SHEET 1/1</text>
      </g>
    </svg>
  );
}

function Eyebrow({ children, color = C.blue }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>
      <Grainline h={16} color={color} stroke={2.4} />
      <span>{children}</span>
    </div>
  );
}

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 0.9, 0.35, 1] } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

function Reveal({ children, style, as = 'div' }) {
  const M = motion[as];
  return (
    <M variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} style={style}>
      {children}
    </M>
  );
}

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="ds-root">
      <style>{CSS}</style>

      {/* ── title bar ─────────────────────────────────────────────────────── */}
      <header className="ds-bar">
        <div className="ds-bar-in">
          <div className="ds-brand">
            <Grainline h={22} color={C.blue} stroke={2.6} />
            <span className="ds-brand-name">Atelier</span>
            <span className="ds-brand-sub">PRODUCTION&nbsp;OS</span>
          </div>
          <nav className="ds-nav">
            <a href="#index" className="ds-nav-link">Index</a>
            <a href="#pricing" className="ds-nav-link">Pricing</a>
            <button className="ds-btn ds-btn-ghost" onClick={() => navigate('/login')}>Log in</button>
            <button className="ds-btn ds-btn-solid" onClick={() => navigate('/signup')}>Start free</button>
          </nav>
        </div>
      </header>

      {/* ── hero ──────────────────────────────────────────────────────────── */}
      <section className="ds-hero">
        <CornerMarks />
        <div className="ds-hero-grid">
          <motion.div className="ds-hero-copy" variants={stagger} initial="hidden" animate="show">
            <motion.div variants={reveal}><Eyebrow>Rev 2.1 · For independent labels</Eyebrow></motion.div>
            <motion.h1 variants={reveal} className="ds-h1">
              From flat<br />sketch to<br /><span className="ds-h1-blue">finished run.</span>
            </motion.h1>
            <motion.p variants={reveal} className="ds-lede">
              Atelier is the production workspace for independent clothing brands — design, tech-pack, source, sample, and manufacture a product in one place, instead of a stack of spreadsheets, DMs, and freelance tech-pack files.
            </motion.p>
            <motion.div variants={reveal} className="ds-cta-row">
              <button className="ds-btn ds-btn-solid ds-btn-lg" onClick={() => navigate('/signup')}>
                Start free <span className="ds-btn-arrow">→</span>
              </button>
              <a href="#index" className="ds-btn ds-btn-line ds-btn-lg">See the spec</a>
            </motion.div>
            <motion.div variants={reveal} className="ds-note">
              <span className="ds-tick" /> No card. The free plan runs one product, forever.
            </motion.div>
          </motion.div>

          <div className="ds-hero-panel">
            <DraftPanel />
          </div>
        </div>

        {/* spec strip — true one-liners, not fabricated stats */}
        <div className="ds-strip">
          {['6 stages · concept → sold', 'AI assists — never decides', 'Real vendors, real quotes', 'Free plan, one product, forever'].map((t, i) => (
            <span key={i} className="ds-strip-item"><Grainline h={12} color={C.ink3} stroke={2.6} /> {t}</span>
          ))}
        </div>
      </section>

      {/* ── mission — inverted title block band ───────────────────────────── */}
      <section className="ds-mission">
        <div className="ds-wrap">
          <Reveal><Eyebrow color="#7FB3D0">Mission</Eyebrow></Reveal>
          <Reveal as="p" style={{ margin: 0 }}>
            <span className="ds-mission-lead">
              Starting a clothing brand shouldn't take a rolodex, a manufacturing degree, and a miracle.
            </span>{' '}
            <span className="ds-mission-body">
              Atelier gives an independent founder the tools to take a sketch seriously — and turn it into something real, sourceable, and sellable.
            </span>
          </Reveal>
          <Reveal>
            <div className="ds-mission-foot">AI drafts, extracts, scores, and suggests. You review and decide — always.</div>
          </Reveal>
        </div>
      </section>

      {/* ── specification index (features) ───────────────────────────────── */}
      <section className="ds-section" id="index">
        <div className="ds-wrap">
          <Reveal>
            <div className="ds-sec-head">
              <Eyebrow>Specification index</Eyebrow>
              <h2 className="ds-h2">Every stage of making a product — on one sheet.</h2>
            </div>
          </Reveal>
          <motion.div className="ds-index" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            {FEATURES.map(f => (
              <motion.article key={f.n} variants={reveal} className="ds-cell">
                <span className="ds-cell-corner" aria-hidden />
                <div className="ds-cell-n">{f.n}</div>
                <h3 className="ds-cell-title">{f.title}</h3>
                <p className="ds-cell-text">{f.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── flow — a grade rule from concept to sold ─────────────────────── */}
      <section className="ds-section ds-flow-sec">
        <div className="ds-wrap">
          <Reveal><Eyebrow>Assembly sequence</Eyebrow></Reveal>
          <Reveal><h2 className="ds-h2" style={{ marginBottom: 34 }}>One product, one path — measured end to end.</h2></Reveal>
          <Reveal>
            <div className="ds-rule">
              <div className="ds-rule-line" aria-hidden />
              {STAGES.map((s, i) => (
                <div className="ds-rule-stop" key={s.key}>
                  <span className="ds-rule-tick" aria-hidden />
                  <span className="ds-rule-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ds-rule-label">{s.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── pricing ───────────────────────────────────────────────────────── */}
      <section className="ds-section" id="pricing">
        <div className="ds-wrap">
          <Reveal>
            <div className="ds-sec-head">
              <Eyebrow>Size run</Eyebrow>
              <h2 className="ds-h2">Start free. Grow into it.</h2>
            </div>
          </Reveal>
          <motion.div className="ds-price" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            {PLANS.map(p => {
              const feature = p.id === 'basic';
              return (
                <motion.div key={p.id} variants={reveal} className={`ds-plan${feature ? ' ds-plan-feat' : ''}`}>
                  {feature && <div className="ds-plan-flag">Most chosen</div>}
                  <div className="ds-plan-name">{p.name}</div>
                  <div className="ds-plan-tag">{p.tagline}</div>
                  <div className="ds-plan-price"><span className="ds-plan-amt">{p.price}</span><span className="ds-plan-suf">{p.priceSuffix}</span></div>
                  <div className="ds-plan-rule" />
                  <ul className="ds-plan-list">
                    {p.summary.map(s => (
                      <li key={s}><Grainline h={12} color={feature ? '#7FB3D0' : C.blue} stroke={2.6} /><span>{s}</span></li>
                    ))}
                  </ul>
                  <button className={`ds-btn ds-btn-lg ${feature ? 'ds-btn-cream' : 'ds-btn-solid'}`} style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/signup')}>
                    {p.id === 'free' ? 'Start for free' : `Choose ${p.name}`}
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── final cta ─────────────────────────────────────────────────────── */}
      <section className="ds-section">
        <div className="ds-wrap">
          <Reveal>
            <div className="ds-final">
              <CornerMarks color="rgba(233,234,228,0.35)" />
              <Grainline h={40} color="#7FB3D0" stroke={2.4} />
              <h2 className="ds-final-h">Your next product deserves a real workspace.</h2>
              <p className="ds-final-p">Set up your brand in a couple minutes and start on your first product today — free, no card needed.</p>
              <button className="ds-btn ds-btn-cream ds-btn-lg" onClick={() => navigate('/signup')}>Start free <span className="ds-btn-arrow">→</span></button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── footer title block ────────────────────────────────────────────── */}
      <footer className="ds-foot">
        <div className="ds-wrap ds-foot-in">
          <div className="ds-brand">
            <Grainline h={18} color={C.ink} stroke={2.6} />
            <span className="ds-brand-name" style={{ color: C.ink }}>Atelier</span>
          </div>
          <div className="ds-foot-meta">Production OS for independent clothing brands</div>
          <div className="ds-foot-links">
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Log in</a>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/terms'); }}>Terms</a>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/privacy'); }}>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.ds-root { background: ${C.sheet}; color: ${C.ink}; font-family: ${BODY};
  min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
  background-image: linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px);
  background-size: 26px 26px; background-position: center top; }
.ds-root ::selection { background: ${C.blue}; color: ${C.cream}; }
.ds-wrap { max-width: 1120px; margin: 0 auto; padding: 0 28px; }

/* title bar */
.ds-bar { position: sticky; top: 0; z-index: 40; background: rgba(231,232,226,0.82);
  backdrop-filter: blur(8px); border-bottom: 1px solid ${C.line2}; }
.ds-bar-in { max-width: 1120px; margin: 0 auto; padding: 12px 28px; display: flex; align-items: center; justify-content: space-between; }
.ds-brand { display: flex; align-items: center; gap: 9px; }
.ds-brand-name { font-family: ${DISPLAY}; font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
.ds-brand-sub { font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.16em; color: ${C.ink3}; padding: 3px 6px; border: 1px solid ${C.line2}; border-radius: 3px; }
.ds-nav { display: flex; align-items: center; gap: 20px; }
.ds-nav-link { font-family: ${MONO}; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: ${C.ink2}; text-decoration: none; }
.ds-nav-link:hover { color: ${C.ink}; }

/* buttons */
.ds-btn { font-family: ${MONO}; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  border: 1.5px solid transparent; border-radius: 4px; padding: 9px 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; transition: transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease; }
.ds-btn:active { transform: translateY(1px); }
.ds-btn-lg { padding: 13px 22px; font-size: 13px; }
.ds-btn-solid { background: ${C.ink}; color: ${C.cream}; border-color: ${C.ink}; }
.ds-btn-solid:hover { background: ${C.blueDeep}; border-color: ${C.blueDeep}; }
.ds-btn-cream { background: ${C.cream}; color: ${C.ink}; border-color: ${C.cream}; }
.ds-btn-cream:hover { background: #fff; }
.ds-btn-line { background: transparent; color: ${C.ink}; border-color: ${C.ink}; }
.ds-btn-line:hover { background: ${C.ink}; color: ${C.cream}; }
.ds-btn-ghost { background: transparent; color: ${C.ink2}; border-color: transparent; }
.ds-btn-ghost:hover { color: ${C.ink}; }
.ds-btn-arrow { transition: transform .16s ease; }
.ds-btn:hover .ds-btn-arrow { transform: translateX(3px); }

/* hero */
.ds-hero { position: relative; padding: 64px 0 20px; }
.ds-hero-grid { max-width: 1120px; margin: 0 auto; padding: 0 28px; display: grid; grid-template-columns: 1.02fr 1.1fr; gap: 40px; align-items: center; }
.ds-hero-copy { display: flex; flex-direction: column; gap: 22px; }
.ds-h1 { font-family: ${DISPLAY}; font-weight: 900; font-size: clamp(42px, 6.4vw, 82px); line-height: 0.94;
  letter-spacing: -0.025em; text-transform: uppercase; margin: 4px 0 0; }
.ds-h1-blue { color: ${C.blue}; }
.ds-lede { font-size: 16.5px; line-height: 1.62; color: ${C.ink2}; max-width: 480px; margin: 0; }
.ds-cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ds-note { font-family: ${MONO}; font-size: 12px; color: ${C.ink3}; display: flex; align-items: center; gap: 9px; }
.ds-tick { width: 7px; height: 7px; background: ${C.blue}; border-radius: 50%; flex-shrink: 0; }
.ds-hero-panel { border: 1.5px solid ${C.line2}; border-radius: 6px; background: ${C.panel}; box-shadow: 0 24px 60px -30px rgba(21,23,27,0.32); overflow: hidden; }

/* spec strip */
.ds-strip { max-width: 1120px; margin: 44px auto 0; padding: 16px 28px; border-top: 1px solid ${C.line2}; border-bottom: 1px solid ${C.line2};
  display: flex; flex-wrap: wrap; gap: 12px 30px; }
.ds-strip-item { font-family: ${MONO}; font-size: 12px; letter-spacing: 0.03em; color: ${C.ink2}; display: inline-flex; align-items: center; gap: 8px; text-transform: uppercase; }

/* mission */
.ds-mission { background: ${C.ink}; color: ${C.cream}; padding: 96px 0; margin-top: 60px; }
.ds-mission .ds-wrap { display: flex; flex-direction: column; gap: 26px; max-width: 900px; }
.ds-mission-lead { font-family: ${DISPLAY}; font-weight: 800; font-size: clamp(24px, 3.4vw, 38px); line-height: 1.18; letter-spacing: -0.01em; color: ${C.cream}; }
.ds-mission-body { font-size: clamp(18px, 2.2vw, 24px); line-height: 1.5; color: #A9B4BC; font-family: ${BODY}; }
.ds-mission-foot { font-family: ${MONO}; font-size: 12.5px; letter-spacing: 0.04em; color: #7FB3D0; text-transform: uppercase; }

/* generic section */
.ds-section { padding: 90px 0; }
.ds-sec-head { display: flex; flex-direction: column; gap: 14px; margin-bottom: 40px; }
.ds-h2 { font-family: ${DISPLAY}; font-weight: 800; font-size: clamp(26px, 3.6vw, 40px); line-height: 1.06; letter-spacing: -0.02em; text-transform: uppercase; margin: 0; max-width: 640px; }

/* specification index */
.ds-index { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1.5px solid ${C.line2}; border-left: 1.5px solid ${C.line2}; }
.ds-cell { position: relative; padding: 26px 24px 30px; border-right: 1.5px solid ${C.line2}; border-bottom: 1.5px solid ${C.line2}; background: ${C.sheet2}; transition: background .16s ease; }
.ds-cell:hover { background: ${C.panel}; }
.ds-cell-corner { position: absolute; top: 0; right: 0; width: 14px; height: 14px; border-top: 2px solid transparent; border-right: 2px solid transparent; transition: border-color .16s ease; }
.ds-cell:hover .ds-cell-corner { border-color: ${C.blue}; }
.ds-cell-n { font-family: ${MONO}; font-size: 12px; font-weight: 700; color: ${C.blue}; letter-spacing: 0.08em; }
.ds-cell-title { font-family: ${DISPLAY}; font-weight: 700; font-size: 16.5px; margin: 12px 0 8px; letter-spacing: -0.01em; }
.ds-cell-text { font-size: 13px; line-height: 1.6; color: ${C.ink2}; margin: 0; }

/* flow rule */
.ds-flow-sec { background: ${C.sheet2}; border-top: 1px solid ${C.line2}; border-bottom: 1px solid ${C.line2}; }
.ds-rule { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; padding-top: 26px; }
.ds-rule-line { position: absolute; top: 26px; left: 0; right: 0; height: 2px; background: ${C.line2}; }
.ds-rule-stop { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.ds-rule-tick { width: 2px; height: 16px; background: ${C.blue}; margin-top: -7px; }
.ds-rule-n { font-family: ${MONO}; font-size: 12px; font-weight: 700; color: ${C.blue}; }
.ds-rule-label { font-family: ${DISPLAY}; font-weight: 700; font-size: 13.5px; letter-spacing: -0.01em; line-height: 1.15; }

/* pricing */
.ds-price { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.ds-plan { position: relative; border: 1.5px solid ${C.line2}; border-radius: 6px; background: ${C.sheet2}; padding: 26px 24px; display: flex; flex-direction: column; }
.ds-plan-feat { background: ${C.ink}; color: ${C.cream}; border-color: ${C.ink}; }
.ds-plan-flag { position: absolute; top: -11px; left: 24px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: ${C.blue}; color: ${C.cream}; padding: 4px 10px; border-radius: 3px; }
.ds-plan-name { font-family: ${DISPLAY}; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: -0.01em; }
.ds-plan-tag { font-size: 12.5px; color: ${C.ink3}; margin-top: 4px; }
.ds-plan-feat .ds-plan-tag { color: #9BA6AE; }
.ds-plan-price { display: flex; align-items: baseline; gap: 5px; margin: 18px 0; }
.ds-plan-amt { font-family: ${MONO}; font-size: 34px; font-weight: 700; }
.ds-plan-suf { font-family: ${MONO}; font-size: 12px; color: ${C.ink3}; }
.ds-plan-feat .ds-plan-suf { color: #9BA6AE; }
.ds-plan-rule { height: 1px; background: ${C.line2}; margin-bottom: 18px; }
.ds-plan-feat .ds-plan-rule { background: rgba(233,234,228,0.18); }
.ds-plan-list { list-style: none; margin: 0 0 22px; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.ds-plan-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; }
.ds-plan-list svg { margin-top: 1px; flex-shrink: 0; }

/* final cta */
.ds-final { position: relative; background: ${C.ink}; color: ${C.cream}; border-radius: 8px; padding: 60px 40px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.ds-final-h { font-family: ${DISPLAY}; font-weight: 800; font-size: clamp(24px, 3.4vw, 36px); text-transform: uppercase; letter-spacing: -0.02em; line-height: 1.08; margin: 4px 0 0; max-width: 560px; }
.ds-final-p { font-size: 14.5px; color: #A9B4BC; max-width: 460px; margin: 0 0 8px; line-height: 1.6; }

/* footer */
.ds-foot { border-top: 1.5px solid ${C.line2}; padding: 26px 0 40px; }
.ds-foot-in { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
.ds-foot-meta { font-family: ${MONO}; font-size: 11.5px; color: ${C.ink3}; letter-spacing: 0.03em; }
.ds-foot-links { display: flex; gap: 20px; }
.ds-foot-links a { font-family: ${MONO}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${C.ink2}; text-decoration: none; }
.ds-foot-links a:hover { color: ${C.blue}; }

/* responsive */
@media (max-width: 900px) {
  .ds-hero-grid { grid-template-columns: 1fr; gap: 30px; }
  .ds-hero { padding-top: 40px; }
  .ds-index { grid-template-columns: repeat(2, 1fr); }
  .ds-rule { grid-template-columns: repeat(4, 1fr); row-gap: 22px; }
  .ds-rule-line { display: none; }
  .ds-price { grid-template-columns: 1fr; }
  .ds-nav .ds-nav-link { display: none; }
}
@media (max-width: 640px) {
  .ds-brand-sub { display: none; }
  .ds-bar-in { padding: 11px 18px; }
  .ds-nav { gap: 12px; }
  .ds-wrap, .ds-hero-grid { padding-left: 18px; padding-right: 18px; }
}
@media (max-width: 520px) {
  .ds-index { grid-template-columns: 1fr; }
  .ds-rule { grid-template-columns: repeat(2, 1fr); }
  .ds-mission { padding: 68px 0; }
  .ds-section { padding: 64px 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ds-btn, .ds-btn-arrow { transition: none; }
}
`;
