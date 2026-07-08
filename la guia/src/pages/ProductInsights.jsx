import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { productPerformance, financialModels } from '../data/mockData.js';
import { currency, percent } from '../lib/format.js';
import { useProducts } from '../context/ProductsContext.jsx';
import FlowStepper from '../components/FlowStepper.jsx';
import TabBar from '../components/TabBar.jsx';
import EmptyState from '../components/EmptyState.jsx';

const TABS = [
  { key: 'performance', label: 'Performance', icon: 'ph-chart-line-up' },
  { key: 'financial', label: 'Financial Model', icon: 'ph-calculator' },
];

export default function ProductInsights() {
  const { id } = useParams();
  const { products } = useProducts();
  const [tab, setTab] = useState('performance');
  const product = products.find(p => p.id === id);
  const perf = productPerformance[id];
  const fin = financialModels[id];

  if (!product) {
    return <div className="content"><EmptyState icon="ph-magnifying-glass" title="Product not found" sub="This product doesn't exist yet." /></div>;
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-eyebrow" style={{ color: 'var(--c-analytics)' }}>Analytics & Sales</div>
            <h1 className="page-title">{product.name}</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 30px 0' }}>
        <FlowStepper productId={product.id} current="sales" />
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} accent="var(--c-analytics)" />

      <div className="content">
        {tab === 'performance' && (
          perf ? (
            <div className="stats-row">
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-analytics)' }}>
                <div className="stat-label">Sell-through</div>
                <div className="stat-value">{percent(perf.sellThrough)}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-analytics)' }}>
                <div className="stat-label">Inventory risk</div>
                <div className="stat-value" style={{ fontSize: 19 }}>{perf.inventoryRisk}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-analytics)' }}>
                <div className="stat-label">Units sold</div>
                <div className="stat-value">{perf.unitsSold}</div>
              </div>
              <div className="stat-card" style={{ '--stat-accent': 'var(--c-analytics)' }}>
                <div className="stat-label">Units remaining</div>
                <div className="stat-value">{perf.unitsRemaining}</div>
              </div>
            </div>
          ) : <EmptyState icon="ph-chart-line-up" color="var(--c-analytics)" title="Not launched yet" sub="Sell-through and inventory risk will appear here once this product goes live." />
        )}

        {tab === 'financial' && (
          fin ? (
            <div className="grid-2">
              <div className="card-raised">
                <div className="card-header"><span className="card-title">Cost inputs</span></div>
                <div className="card-body">
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Unit cost</span><strong>{currency(fin.unitCost)}</strong></div>
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Wholesale price</span><strong>{currency(fin.wholesalePrice)}</strong></div>
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Retail price</span><strong>{currency(fin.retailPrice)}</strong></div>
                </div>
              </div>
              <div className="card-raised">
                <div className="card-header"><span className="card-title">Break-even & suggestion</span></div>
                <div className="card-body">
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Break-even units</span><strong>{fin.breakEvenUnits}</strong></div>
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Suggested retail</span><strong>{currency(fin.suggestedRetail)}</strong></div>
                  <div className="list-row" style={{ padding: '10px 0' }}><span>Margin at retail</span><strong style={{ color: 'var(--green)' }}>{percent(fin.marginAtRetail)}</strong></div>
                </div>
              </div>
            </div>
          ) : <EmptyState icon="ph-calculator" color="var(--c-analytics)" title="No pricing model yet" sub="Cost inputs, break-even units, and suggested pricing will appear once vendor quotes are in." />
        )}
      </div>
    </>
  );
}
