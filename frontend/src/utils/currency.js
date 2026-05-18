/**
 * Convierte un valor monetario a euros.
 * @param {number} value  - valor numérico
 * @param {string} quote  - moneda de cotización del par (ej: "USDT", "USD", "EUR")
 * @param {number} eurUsd - tipo de cambio EUR/USD (cuántos USD vale 1 EUR)
 */
export function toEUR(value, quote, eurUsd) {
  if (value == null || !eurUsd) return null;
  const q = (quote || '').toUpperCase();
  if (q === 'EUR' || q === 'ZEUR' || q === 'EURT') return value;
  if (q === 'USD' || q === 'USDT' || q === 'BUSD' || q === 'ZUSD' || q === 'USDC') return value / eurUsd;
  // Para monedas crypto desconocidas, devuelve null en lugar del valor bruto
  // (el valor correcto viene de backend.value_eur, no de esta función)
  return null;
}

/**
 * Extrae la moneda de cotización de un símbolo de par.
 * "BTC/USDT" → "USDT",  "ETH/EUR" → "EUR"
 */
export function quoteOf(symbol) {
  return symbol?.split('/')[1] ?? 'USD';
}

/** Formatea un número como euros con 2 decimales. */
export function fmtEUR(value, decimals = 2) {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formatea un número como euros con precisión variable (para precios altos y bajos). */
export function fmtPrice(value, quote, eurUsd) {
  const eur = toEUR(value, quote, eurUsd);
  if (eur == null) return '—';
  const decimals = eur >= 1000 ? 2 : eur >= 1 ? 4 : 6;
  return fmtEUR(eur, decimals);
}
