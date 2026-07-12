// Deterministic SKU generation — no AI needed, this is pure formatting.
// Format: {BRAND}-{CATEGORY}-{PRODUCT}-{COLOR}-{SIZE}, e.g. GRA-HOO-DENI-BLK-M
function code(str, len) {
  const clean = (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (clean.slice(0, len) || 'XXX').padEnd(Math.min(len, clean.length || len), 'X');
}

export function generateSku({ brandName, category, productName, colorway, size }) {
  return [code(brandName, 3), code(category, 3), code(productName, 4), code(colorway, 3), (size || '').toUpperCase().replace(/[^A-Z0-9]/g, '')]
    .filter(Boolean)
    .join('-');
}
