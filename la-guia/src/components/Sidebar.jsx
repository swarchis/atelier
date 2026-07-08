import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { brands, activeBrandId, notifications } from '../data/mockData.js';

const NAV_GROUPS = [
  { label: 'Overview', color: 'var(--c-home)', items: [{ path: '/', icon: 'ph-house', label: 'Home' }] },
  { label: 'Design', color: 'var(--c-design)', items: [{ path: '/design', icon: 'ph-pencil-simple', label: 'Design' }] },
  { label: 'Tech Packs', color: 'var(--c-techpack)', items: [{ path: '/tech-packs', icon: 'ph-ruler', label: 'Tech Pack List' }] },
  { label: 'Organization', color: 'var(--c-organization)', items: [{ path: '/collections', icon: 'ph-stack', label: 'Collections' }] },
  { label: 'Vendors', color: 'var(--c-vendors)', items: [
    { path: '/vendors', icon: 'ph-handshake', label: 'Discover & Compare' },
    { path: '/quotes', icon: 'ph-file-text', label: 'Quote Tracker' },
  ] },
  { label: 'Materials & Production', color: 'var(--c-materials)', items: [
    { path: '/materials', icon: 'ph-flask', label: 'Material Library' },
    { path: '/production', icon: 'ph-package', label: 'Production Orders' },
  ] },
  { label: 'Final Check', color: 'var(--c-finalcheck)', items: [{ path: '/readiness', icon: 'ph-check-circle', label: 'Readiness Review' }] },
  { label: 'Analytics & Sales', color: 'var(--c-analytics)', items: [{ path: '/sales', icon: 'ph-chart-line-up', label: 'Sales Dashboard' }] },
  { label: 'Content & Marketing', color: 'var(--c-content)', items: [{ path: '/content', icon: 'ph-megaphone', label: 'Content Hub' }] },
];

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('grainline_theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grainline_theme', theme);
  }, [theme]);
  return { isDark: theme === 'dark', toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}

function GrainlineMark({ size = 22 }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 8h9m4 0h9M14 8l-4-4m0 8 4-4M10 8l4-4m-4 4 4 4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar() {
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [brandOpen, setBrandOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState(brands.find(b => b.id === activeBrandId));
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('grainline_nav_collapsed')) || []; } catch { return []; }
  });
  const unread = notifications.filter(n => !n.read).length;

  const toggleGroup = label => setCollapsed(prev => {
    const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
    try { localStorage.setItem('grainline_nav_collapsed', JSON.stringify(next)); } catch {}
    return next;
  });

  return (
    <nav
      style={{
        width: 'var(--sidebar-w)', flexShrink: 0, background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0, overflowY: 'auto',
      }}
    >
      {/* Wordmark + bell */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <GrainlineMark />
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Grainline
            </span>
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--ink-4)', marginTop: 6, fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Production OS
          </div>
        </div>
        <button className="bell-btn" onClick={() => navigate('/notifications')} title="Notifications">
          <i className="ph ph-bell" style={{ fontSize: 15 }} />
          {unread > 0 && <span className="bell-dot" />}
        </button>
      </div>

      {/* Brand switcher */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <div
          onClick={() => setBrandOpen(o => !o)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--ink-4)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
              Brand
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{activeBrand.name}</div>
          </div>
          <i className="ph ph-caret-up-down" style={{ fontSize: 13, color: 'var(--ink-3)' }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="tag tag-accent">{activeBrand.globalRisk} · default risk</span>
        </div>

        {brandOpen && (
          <div className="brand-switch-panel">
            {brands.map(b => (
              <div
                key={b.id}
                className="brand-switch-item"
                onClick={() => { setActiveBrand(b); setBrandOpen(false); }}
              >
                <span style={{ fontWeight: b.id === activeBrand.id ? 600 : 400 }}>{b.name}</span>
                {b.id === activeBrand.id && <i className="ph ph-check" style={{ color: 'var(--accent)' }} />}
              </div>
            ))}
            <div className="brand-switch-item" style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--border)' }}>
              <i className="ph ph-plus" style={{ marginRight: 8 }} /> Add a brand
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '6px 0 8px' }}>
        {NAV_GROUPS.map(group => {
          const isCollapsed = collapsed.includes(group.label);
          return (
            <div key={group.label}>
              <div className="nav-group-label" onClick={() => toggleGroup(group.label)}>
                <span className={`nav-caret ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
                <span style={{ flex: 1 }}>{group.label}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: group.color, opacity: 0.85 }} />
              </div>
              {!isCollapsed && group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className="nav-item"
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                    background: isActive ? `color-mix(in srgb, ${group.color} 12%, var(--bg-1))` : 'transparent',
                    border: isActive ? `1px solid color-mix(in srgb, ${group.color} 30%, transparent)` : '1px solid transparent',
                  })}
                >
                  <i className={`ph ${item.icon} nav-item-icon`} style={{ color: group.color }} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <NavLink to="/settings" className="nav-item" style={({ isActive }) => ({
          color: isActive ? 'var(--ink)' : 'var(--ink-3)',
          background: isActive ? 'var(--bg-3)' : 'transparent',
          border: isActive ? '1px solid var(--border-2)' : '1px solid transparent',
          margin: '1px 0',
        })}>
          <i className="ph ph-gear-six nav-item-icon" style={{ color: 'var(--c-settings)' }} />
          <span>Profile & Settings</span>
        </NavLink>
        <button onClick={toggle} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 13px', background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)',
        }}>
          <span>{isDark ? 'Dark' : 'Light'}</span>
          <i className={`ph ${isDark ? 'ph-moon' : 'ph-sun'}`} style={{ fontSize: 13 }} />
        </button>
        <div style={{ padding: '8px 13px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>Founder workspace</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 1 }}>owner</div>
        </div>
      </div>
    </nav>
  );
}
