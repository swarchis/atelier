import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useProducts } from '../../context/ProductsContext.jsx';
import { Thumbtack } from '../decor.jsx';

const PAPER = 'var(--bg-1)';
const DEFAULT_NOTE = (slot) => ({ slot, mode: 'text', text_content: '', drawing_data: null });

// A minimal freehand pencil tool — draws directly on a canvas and reports
// the flattened PNG back up on every stroke-end so the note auto-saves
// without needing an explicit "save" click.
function DrawCanvas({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fdf8ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0];
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvasRef.current.width / rect.width), y: (clientY - rect.top) * (canvasRef.current.height / rect.height) };
  };

  const start = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.strokeStyle = '#3a3226';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = (e) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fdf8ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/png'));
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef} width={300} height={200}
        style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button
        onClick={clear}
        style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(20,17,12,0.6)', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}
      >
        Clear
      </button>
    </div>
  );
}

function ModeToggle({ mode, onSetMode }) {
  return (
    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3, zIndex: 2 }}>
      <button
        title="Type" onClick={e => { e.stopPropagation(); onSetMode('text'); }}
        style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: mode === 'text' ? 'rgba(20,17,12,0.75)' : 'rgba(20,17,12,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
      ><i className="ph ph-text-t" style={{ fontSize: 10 }} /></button>
      <button
        title="Draw" onClick={e => { e.stopPropagation(); onSetMode('draw'); }}
        style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: mode === 'draw' ? 'rgba(20,17,12,0.75)' : 'rgba(20,17,12,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
      ><i className="ph ph-pencil-simple" style={{ fontSize: 10 }} /></button>
    </div>
  );
}

// Styled to match the hero's "pinned photo" motif (a Polaroid-like curled,
// tilted, thumbtacked card) since this replaces what was a purely decorative
// "Working sketch" placeholder in that exact spot — same physical shape,
// now an actual working sketch/notes surface with three swappable slots.
export default function StickyNotes() {
  const { activeBrand } = useProducts();
  const [notes, setNotes] = useState([DEFAULT_NOTE(0), DEFAULT_NOTE(1), DEFAULT_NOTE(2)]);
  const [activeSlot, setActiveSlotState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!activeBrand) return;
    try { setActiveSlotState(Number(localStorage.getItem(`grainline_notes_active_${activeBrand.id}`)) || 0); } catch { setActiveSlotState(0); }

    async function load() {
      setLoaded(false);
      const { data, error } = await supabase.from('brand_notes').select('*').eq('brand_id', activeBrand.id);
      if (!error) {
        const bySlot = [0, 1, 2].map(slot => (data || []).find(n => n.slot === slot) || DEFAULT_NOTE(slot));
        setNotes(bySlot);
      }
      setLoaded(true);
    }
    load();
  }, [activeBrand?.id]);

  const persist = (slot, updates) => {
    if (!activeBrand) return;
    supabase.from('brand_notes')
      .upsert({ brand_id: activeBrand.id, slot, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'brand_id,slot' })
      .then(({ error }) => { if (error) console.error('Failed to save note:', error.message); });
  };

  const updateNote = (slot, updates, debounce) => {
    setNotes(prev => prev.map(n => (n.slot === slot ? { ...n, ...updates } : n)));
    if (debounce) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(slot, updates), 700);
    } else {
      persist(slot, updates);
    }
  };

  const swapTo = (slot) => {
    setActiveSlotState(slot);
    if (activeBrand) { try { localStorage.setItem(`grainline_notes_active_${activeBrand.id}`, String(slot)); } catch {} }
  };

  const active = notes.find(n => n.slot === activeSlot) || DEFAULT_NOTE(activeSlot);
  const storage = notes.filter(n => n.slot !== activeSlot);
  const smallTilt = [-3, 2.5];
  const smallPin = ['var(--c-vendors)', 'var(--sage)'];

  if (!loaded) return <div style={{ width: '92%' }} />;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
      <div className="photo-curl" style={{ '--curl-tilt': '1.5deg', width: '92%' }}>
        <div className="photo-pin"><Thumbtack size={15} color="var(--c-design)" /></div>
        <div className="photo-curl-inner" style={{ aspectRatio: '16 / 11', position: 'relative', background: PAPER }}>
          <ModeToggle mode={active.mode} onSetMode={m => updateNote(active.slot, { mode: m }, false)} />
          {active.mode === 'text' ? (
            <textarea
              value={active.text_content || ''}
              onChange={e => updateNote(active.slot, { text_content: e.target.value }, true)}
              placeholder="Working sketch — jot something down…"
              style={{
                position: 'absolute', inset: 0, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--hand)', fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.4, padding: '12px 14px',
              }}
            />
          ) : (
            <DrawCanvas value={active.drawing_data} onChange={dataUrl => updateNote(active.slot, { drawing_data: dataUrl }, false)} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {storage.map((n, i) => (
          <div
            key={n.slot}
            className="photo-curl"
            title="Swap to this note"
            onClick={() => swapTo(n.slot)}
            style={{ '--curl-tilt': `${smallTilt[i]}deg`, width: 82, cursor: 'pointer' }}
          >
            <div className="photo-pin"><Thumbtack size={12} color={smallPin[i]} /></div>
            <div className="photo-curl-inner" style={{ aspectRatio: '1 / 1', background: PAPER, position: 'relative', overflow: 'hidden' }}>
              {n.mode === 'draw' && n.drawing_data ? (
                <img src={n.drawing_data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, padding: '6px 7px', fontFamily: 'var(--hand)', fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                  {n.text_content?.trim() || 'Empty'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
