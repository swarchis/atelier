import React, { useState } from 'react';
import { notifications as initialNotifications } from '../data/mockData.js';

const TYPE_ICON = { success: 'ph-check-circle', info: 'ph-info', warning: 'ph-warning' };
const TYPE_COLOR = { success: 'var(--green)', info: 'var(--blue)', warning: 'var(--amber)' };

export default function NotificationsInbox() {
  const [items, setItems] = useState(initialNotifications);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-settings)' }}>Notifications</div>
            <h1 className="page-title">Inbox</h1>
          </div>
          <div className="page-sub">{items.filter(n => !n.read).length} unread</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" onClick={() => setItems(items.map(n => ({ ...n, read: true })))}>Mark all read</button>
        </div>
      </div>

      <div className="content">
        <div className="card">
          {items.map(n => (
            <div className="list-row" key={n.id} style={{ background: n.read ? 'transparent' : 'var(--accent-bg)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <i className={`ph ${TYPE_ICON[n.type]}`} style={{ fontSize: 18, color: TYPE_COLOR[n.type], marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{n.body}</div>
                </div>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{n.time}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
