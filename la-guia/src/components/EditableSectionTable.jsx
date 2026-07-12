import React from 'react';

// Shared table UI for every simple list-of-objects tech pack section
// (construction, print placements, trims, labels, packaging, material
// usage) — same add/edit/remove-row interaction as the BOM/Measurements
// tables, just parameterized by column definitions instead of repeating the
// markup six more times.
export default function EditableSectionTable({ columns, rows, onUpdate, onAdd, onRemove, addLabel, blankRow, emptyLabel = 'Nothing added yet.' }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{c.label}</th>
            ))}
            <th style={{ width: '4%' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: '8px 20px' }}>
                  {c.multiline ? (
                    <textarea className="form-input" style={{ padding: '8px 12px', fontSize: 13, minHeight: 36, resize: 'vertical' }} placeholder={c.placeholder} value={row[c.key] || ''} onChange={e => onUpdate(row.id, c.key, e.target.value)} />
                  ) : (
                    <input className="form-input" style={{ padding: '8px 12px', fontSize: 13 }} placeholder={c.placeholder} value={row[c.key] || ''} onChange={e => onUpdate(row.id, c.key, e.target.value)} />
                  )}
                </td>
              ))}
              <td style={{ padding: '8px 20px 8px 0', textAlign: 'right' }}>
                <button onClick={() => onRemove(row.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, opacity: 0.6 }}>×</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontStyle: 'italic', fontSize: 12.5 }}>{emptyLabel}</td></tr>
          )}
        </tbody>
      </table>
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-sm" onClick={() => onAdd(blankRow)}><i className="ph ph-plus" /> {addLabel}</button>
      </div>
    </div>
  );
}
