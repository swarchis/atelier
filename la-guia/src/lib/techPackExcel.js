// Real spreadsheet export, deliberately dependency-free: the npm `xlsx`
// package (SheetJS) has known high-severity prototype-pollution/ReDoS
// advisories on its last published version, so rather than pull that in for
// a write-only export, this builds a plain CSV — Excel and Google Sheets
// both open CSV natively, which is exactly what was asked for ("this can
// also be done in Excel/Sheets if it's easier").
function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function section(title, headers, rows) {
  if (!rows || rows.length === 0) return [];
  const lines = [[title], headers];
  rows.forEach(r => lines.push(headers.map((_, i) => r[i])));
  lines.push([]);
  return lines;
}

export function exportTechPackExcel({
  product, bom, measurements, construction, printPlacements, trims, labels, packaging,
  materialUsage, manufacturingNotes, complianceNotes, readinessChecklist, totalBomCost,
}) {
  let lines = [];
  lines.push([`${product.name} — Tech Pack`]);
  lines.push(['Category', product.category]);
  lines.push(['Target unit cost', totalBomCost]);
  lines.push(['Exported', new Date().toLocaleDateString()]);
  lines.push([]);

  lines = lines.concat(section('Bill of Materials', ['Material', 'Supplier', 'Qty/Unit', 'Unit Cost'], bom.filter(b => b.material).map(b => [b.material, b.supplier, b.qtyPerUnit, b.unitCost])));
  lines = lines.concat(section('Measurements', ['Size', 'Chest', 'Length', 'Sleeve'], measurements.filter(m => m.size).map(m => [m.size, m.chest, m.length, m.sleeve])));
  lines = lines.concat(section('Stitch Construction', ['Section', 'Stitch Type', 'Notes'], construction.map(c => [c.section, c.stitchType, c.notes])));
  lines = lines.concat(section('Print Placements', ['Name', 'Placement', 'Size', 'Technique'], printPlacements.map(p => [p.name, p.placement, p.size, p.technique])));
  lines = lines.concat(section('Trims', ['Trim', 'Supplier', 'Quantity', 'Unit Cost'], trims.map(t => [t.name, t.supplier, t.quantity, t.unitCost])));
  lines = lines.concat(section('Labels', ['Type', 'Placement', 'Content'], labels.map(l => [l.type, l.placement, l.content])));
  lines = lines.concat(section('Packaging', ['Item', 'Spec', 'Notes'], packaging.map(p => [p.item, p.spec, p.notes])));
  lines = lines.concat(section('Material Usage', ['Material', 'Consumption/Unit', 'Unit', 'Wastage %'], materialUsage.map(m => [m.material, m.consumptionPerUnit, m.unit, m.wastagePercent])));
  lines = lines.concat(section('Sampling Checklist', ['Status', 'Requirement'], readinessChecklist.map(c => [c.status === 'done' ? 'Approved' : 'Pending', c.label])));

  if (manufacturingNotes) lines.push(['Manufacturing notes', manufacturingNotes], []);
  if (complianceNotes) lines.push(['Compliance notes', complianceNotes], []);

  const csv = lines.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${product.name.replace(/[^a-z0-9]+/gi, '-')}-tech-pack.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
