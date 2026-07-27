import React, { useState } from 'react';
import { useTeam } from '../context/TeamContext.jsx';

// Shown once to someone who has just joined a brand as a team member but has
// no display name yet — until they set one, teammates only see their invite
// email in the member list and in chat. Dismissable: nagging is worse than an
// email address, and Settings → Profile can set it later.
export default function MemberNamePrompt() {
  const { needsDisplayName, setMyDisplayName } = useTeam();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  if (!needsDisplayName || dismissed) return null;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await setMyDisplayName(name);
      setDismissed(true);
    } catch (err) {
      setError(err.message || 'Could not save that name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={() => setDismissed(true)}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} className="card-raised" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <i className="ph ph-user-circle-plus" style={{ color: 'var(--accent)', fontSize: 20 }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>What should the team call you?</h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 16px' }}>
          You've joined the workspace. Add your name so teammates see it instead of your email address in the member list and in chat.
        </p>

        <input
          className="form-input"
          autoFocus
          placeholder="e.g. Alex Rivera"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          style={{ marginBottom: error ? 8 : 16 }}
        />
        {error && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
          <button className="btn btn-sm" onClick={() => setDismissed(true)} disabled={saving}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
