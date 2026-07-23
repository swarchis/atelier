import React from 'react';
import { useNavigate } from 'react-router-dom';

export const FLOW_STAGES = [
  { key: 'design', label: 'Design', icon: 'ph-pencil-simple', color: 'var(--c-design)', path: id => `/design/${id}` },
  { key: 'techpack', label: 'Tech Pack', icon: 'ph-ruler', color: 'var(--c-techpack)', path: id => `/tech-packs/${id}` },
  { key: 'vendors', label: 'Vendors & Quotes', icon: 'ph-handshake', color: 'var(--c-vendors)', path: id => id ? `/quotes?productId=${id}` : '/quotes' },
  { key: 'sampling', label: 'Sampling', icon: 'ph-t-shirt', color: 'var(--c-finalcheck)', path: id => `/sampling/${id}` },
  { key: 'production', label: 'Production', icon: 'ph-package', color: 'var(--c-materials)', path: id => `/production/${id}` },
  { key: 'sales', label: 'Sales', icon: 'ph-chart-line-up', color: 'var(--c-analytics)', path: id => `/products/${id}/performance` },
];

// Lets a founder jump directly between every screen tied to the same product —
// the literal "flow" between the stages of one item's production journey.
export default function FlowStepper({ productId, current }) {
  const navigate = useNavigate();
  const currentIdx = FLOW_STAGES.findIndex(s => s.key === current);

  return (
    <div className="flow-stepper">
      {FLOW_STAGES.map((stage, i) => {
        const state = i === currentIdx ? 'current' : i < currentIdx ? 'done' : '';
        return (
          <React.Fragment key={stage.key}>
            {i > 0 && (
              <div
                className="flow-connector"
                style={{ '--fc-color': i <= currentIdx ? stage.color : 'var(--border-3)' }}
              />
            )}
            <div
              className={`flow-node ${state}`}
              style={{ '--fn-color': stage.color }}
              onClick={() => navigate(stage.path(productId))}
            >
              {stage.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}