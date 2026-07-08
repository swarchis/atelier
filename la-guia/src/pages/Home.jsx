import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { STAGES, collections } from '../data/mockData.js';
import { useProducts } from '../context/ProductsContext.jsx';
import { riskTagClass, readinessColor, currency, stageLink, swatchGradient, tiltForId, SECTION_COLOR } from '../lib/format.js';

const QUICK_ACTIONS = [
  { label: 'New design', icon: 'ph-pencil-simple', color: 'var(--c-design)', path: '/design' },
  { label: 'Import vendor', icon: 'ph-download-simple', color: 'var(--c-vendors)', path: '/vendors' },
  { label: 'Request quote', icon: 'ph-file-text', color: 'var(--c-vendors)', path: '/quotes' },
  { label: 'Review readiness', icon: 'ph-check-circle', color: 'var(--c-finalcheck)', path: '/readiness' },
];

function stageColor(stageKey) {
  const s = STAGES.find(st => st.key === stageKey);
  return s.key === 'launched' ? 'var(--green)' : SECTION_COLOR[s.section];
}

const MENU_WIDTH = 208;
const MENU_HEIGHT_ESTIMATE = 260;

// Portaled to <body> with position:fixed — piece cards sit inside elements that
// have a CSS transform (for the hand-tilt), and a transform creates a new
// stacking context, which traps a nested z-index and lets later sections paint
// over it. Escaping to a body-level portal sidesteps that entirely.
function MoveMenu({ productId, current, anchorRect, onMove, onClose }) {
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE && anchorRect.top > MENU_HEIGHT_ESTIMATE;
  const top = openUpward ? anchorRect.top - 8 : anchorRect.bottom + 8;
  const left = Math.min(Math.max(anchorRect.right - MENU_WIDTH, 8), window.innerWidth - MENU_WIDTH - 8);

  return createPortal(
    <>
      <div className="move-menu-backdrop" onClick={onClose} />
      <div
        className="move-menu"
        style={{ top, left, transform: openUpward ? 'translateY(-100%)' : 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="move-menu-label">Move to…</div>
        {STAGES.filter(s => s.key !== current).map(s => (
          <div key={s.key} className="move-menu-item" onClick={() => { onMove(productId, s.key); onClose(); }}>
            <span className="move-menu-dot" style={{ '--mm-color': stageColor(s.key) }} />
            {s.label}
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}

function PieceCard({ p, dragging, onDragStart, onDragEnd }) {
  const navigate = useNavigate();
  const { moveProduct } = useProducts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const suppressClick = useRef(false);
  const color = stageColor(p.stage);

  const toggleMenu = e => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setMenuOpen(true);
  };

  return (
    <motion.div
      layoutId={p.id}
      layout
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`piece-card ${dragging === p.id ? 'dragging' : ''}`}
      style={{ '--tilt': `${tiltForId(p.id)}deg` }}
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(p.id); }}
      onDragEnd={() => { onDragEnd(); suppressClick.current = true; setTimeout(() => (suppressClick.current = false), 50); }}
      onClick={() => { if (!suppressClick.current && !menuOpen) navigate(stageLink(p.stage, p.id)); }}
    >
      <div className="washi" style={{ '--washi-color': color }} />
      <button className="piece-move-btn" onClick={toggleMenu} title="Move to another stage">
        <i className="ph ph-arrows-out-cardinal" />
      </button>
      {menuOpen && anchorRect && (
        <MoveMenu productId={p.id} current={p.stage} anchorRect={anchorRect} onMove={moveProduct} onClose={() => setMenuOpen(false)} />
      )}
      <div className="piece-card-top">
        <div className="swatch" style={{ background: swatchGradient(p.id) }} />
        <div style={{ minWidth: 0 }}>
          <div className="piece-card-name">{p.name}</div>
          <div className="piece-card-meta">{p.category}</div>
        </div>
      </div>
      <div className="readiness" style={{ marginBottom: 10 }}>
        <div className="readiness-track">
          <div className="readiness-fill" style={{ width: `${p.readiness}%`, background: readinessColor(p.readiness) }} />
          <div className="readiness-gate" style={{ left: '80%' }} />
        </div>
        <span className="readiness-value">{p.readiness}%</span>
      </div>
      <span className={riskTagClass(p.risk)}>{p.risk}</span>
    </motion.div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { products, moveProduct } = useProducts();
  const [draggingId, setDraggingId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const inProduction = products.filter(p => !['concept', 'launched'].includes(p.stage)).length;
  const avgReadiness = Math.round(products.reduce((s, p) => s + p.readiness, 0) / products.length);
  const totalBudget = products.reduce((s, p) => s + p.budget, 0);
  const gateFlags = products.filter(p => p.readiness < 80 && p.stage === 'sourcing').length;

  const scrollTo = key => document.getElementById(`stage-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleDrop = (e, stageKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) moveProduct(id, stageKey);
    setDraggingId(null);
    setOverStage(null);
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-home)' }}>Home</div>
            <h1 className="page-title">{greeting}, founder</h1>
          </div>
          <div className="page-sub">{products.length} active products · {collections.length} collections</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => navigate('/design')}>
            <i className="ph ph-plus" /> New product
          </button>
        </div>
      </div>

      <div className="content">
        <div className="stats-row enter enter-1">
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-home)' }}>
            <div className="stat-label">In production</div>
            <div className="stat-value">{inProduction}</div>
            <div className="stat-delta delta-muted">of {products.length} total products</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-techpack)' }}>
            <div className="stat-label">Avg. factory readiness</div>
            <div className="stat-value">{avgReadiness}%</div>
            <div className="stat-delta delta-muted">gate clears at 80%</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-materials)' }}>
            <div className="stat-label">Committed budget</div>
            <div className="stat-value">{currency(totalBudget)}</div>
            <div className="stat-delta delta-muted">across all workspaces</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': 'var(--c-finalcheck)' }}>
            <div className="stat-label">Stage-gate flags</div>
            <div className="stat-value" style={{ color: gateFlags > 0 ? 'var(--amber)' : 'var(--ink)' }}>{gateFlags}</div>
            <div className="stat-delta delta-muted">below readiness threshold</div>
          </div>
        </div>

        <div className="section-label enter enter-2">Quick actions</div>
        <div className="grid-cards enter enter-2" style={{ marginBottom: 32 }}>
          {QUICK_ACTIONS.map(a => (
            <div key={a.label} className="card-raised card-hover" style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => navigate(a.path)}>
              <div style={{ width: 38, height: 38, borderRadius: '50% 46% 50% 48%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color, flexShrink: 0 }}>
                <i className={`ph ${a.icon}`} style={{ fontSize: 18 }} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{a.label}</span>
            </div>
          ))}
        </div>

        <div className="section-label enter enter-3">Production flow — drag a piece, or drop it on a stage below</div>
        <div className="flow-map enter enter-3">
          {STAGES.map((stage, i) => {
            const color = stageColor(stage.key);
            const count = products.filter(p => p.stage === stage.key).length;
            const prevColor = i > 0 ? stageColor(STAGES[i - 1].key) : color;
            return (
              <React.Fragment key={stage.key}>
                {i > 0 && <div className="flow-map-line" style={{ '--fm-line': prevColor }} />}
                <div
                  className="flow-map-node"
                  onClick={() => scrollTo(stage.key)}
                  onDragOver={e => { e.preventDefault(); setOverStage(stage.key); }}
                  onDrop={e => handleDrop(e, stage.key)}
                >
                  <div className="flow-map-dot" style={{ '--fm-color': color, outline: overStage === stage.key ? `2px solid ${color}` : 'none', outlineOffset: 2 }}>{count}</div>
                  <div className="flow-map-label">{stage.label}</div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <LayoutGroup>
          {STAGES.map((stage, si) => {
            const stageProducts = products.filter(p => p.stage === stage.key);
            const color = stageColor(stage.key);
            const isOver = overStage === stage.key;
            return (
              <div className={`stage-section enter enter-${Math.min(si + 4, 6)}`} id={`stage-${stage.key}`} key={stage.key}>
                <div className="stage-section-header">
                  <span className="stage-section-title">{stage.label}</span>
                  <span className="stage-section-count">{stageProducts.length} {stageProducts.length === 1 ? 'piece' : 'pieces'}</span>
                  <span className="stage-section-line" />
                </div>
                <div
                  className={`stage-rail ${isOver ? 'drop-active' : ''}`}
                  style={{ '--rail-color': isOver ? color : undefined, '--rail-tint': `color-mix(in srgb, ${color} 8%, transparent)` }}
                  onDragOver={e => { e.preventDefault(); setOverStage(stage.key); }}
                  onDragLeave={() => setOverStage(prev => (prev === stage.key ? null : prev))}
                  onDrop={e => handleDrop(e, stage.key)}
                >
                  {stageProducts.length === 0 && <div className="stage-rail-empty">Drop a piece here</div>}
                  {stageProducts.map(p => (
                    <PieceCard
                      key={p.id}
                      p={p}
                      dragging={draggingId}
                      onDragStart={setDraggingId}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
      </div>
    </>
  );
}
