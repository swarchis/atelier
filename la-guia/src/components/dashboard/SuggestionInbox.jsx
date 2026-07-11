import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useProducts } from '../../context/ProductsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUserPreferences } from '../../context/UserPreferencesContext.jsx';

const TYPES = [
  { key: 'suggestion', label: 'Suggestion', icon: 'ph-lightbulb' },
  { key: 'bug', label: 'Bug report', icon: 'ph-bug' },
];

export default function SuggestionInbox() {
  const { activeBrand } = useProducts();
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const [type, setType] = useState('suggestion');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [recentCount, setRecentCount] = useState(null);

  useEffect(() => {
    if (!activeBrand) return;
    supabase.from('feedback_submissions').select('id', { count: 'exact', head: true }).eq('brand_id', activeBrand.id)
      .then(({ count, error: countError }) => { if (!countError) setRecentCount(count); });
  }, [activeBrand?.id, lastSent]);

  const authorName = preferences?.full_name || user?.email?.split('@')[0] || 'You';

  const submit = async () => {
    if (!body.trim() || !activeBrand) return;
    setSending(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('feedback_submissions').insert([{
        brand_id: activeBrand.id, user_id: user?.id, author_name: authorName, type, body: body.trim(),
      }]);
      if (insertError) throw insertError;
      setBody('');
      setLastSent(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card-raised" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>Suggestion inbox</div>

      <div style={{ display: 'flex', gap: 6 }}>
        {TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={t.key === type ? 'tag tag-accent' : 'tag tag-neutral'}
            style={{ border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <i className={`ph ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={type === 'bug' ? "What went wrong, and what were you doing?" : "What should we build or change?"}
        style={{
          flex: 1, minHeight: 70, resize: 'none', fontSize: 12.5, lineHeight: 1.5, padding: '8px 10px',
          borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg-2)', color: 'var(--ink-2)', fontFamily: 'var(--sans)',
        }}
      />

      {error && <div style={{ fontSize: 11.5, color: 'var(--red)' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>
          {lastSent ? 'Sent — thank you.' : recentCount != null ? `${recentCount} sent from this brand` : ''}
        </span>
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
