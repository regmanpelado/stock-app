import React, { useState } from 'react';
import { backtestApi } from '../services/api.jsx';
import BacktestChart from '../components/BacktestChart.jsx';

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'gateio'];
const SYMBOLS_BY_EXCHANGE = {
  binance:  ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT'],
  coinbase: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD'],
  kraken:   ['BTC/EUR', 'ETH/EUR', 'SOL/EUR', 'XRP/EUR', 'BTC/USD'],
  gateio:   ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT'],
};
const STRATEGY_COLOR = {
  dca: '#38bdf8', grid: '#a78bfa', signal: '#fb923c', ia_dynamic: '#34d399',
  market_making: '#f59e0b', arbitrage: '#e879f9', scalping: '#f43f5e',
  mean_reversion: '#06b6d4', momentum: '#84cc16',
};
const STRATEGIES = [
  { id: 'dca',           label: 'DCA',            desc: 'Compras periódicas automáticas' },
  { id: 'grid',          label: 'Grid Trading',   desc: 'Compra/vende en niveles de precio' },
  { id: 'signal',        label: 'Señales RSI',    desc: 'Opera según sobrecompra/sobreventa' },
  { id: 'ia_dynamic',    label: 'IA Dinámico',    desc: 'RSI + MACD + Bollinger — 2+ indicadores' },
  { id: 'market_making', label: 'Market Making',  desc: 'Captura spread bid/ask intradiario' },
  { id: 'arbitrage',     label: 'Arbitraje',      desc: 'Explota diferencias de precio por rango diario' },
  { id: 'scalping',      label: 'Scalping',        desc: 'TP/SL ajustado con RSI y MACD' },
  { id: 'mean_reversion',label: 'Mean Reversion', desc: 'Compra en Bollinger inferior, vende en media' },
  { id: 'momentum',      label: 'Momentum',        desc: 'Entra en tendencia, trailing stop dinámico' },
];
const PERIODS = [
  { id: '1m', label: '1 Mes' },
  { id: '3m', label: '3 Meses' },
  { id: '6m', label: '6 Meses' },
  { id: '1y', label: '1 Año' },
];

function Field({ label, hint, children }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {hint && <span style={{ color: 'var(--t2)', fontWeight: 400 }}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function DCAParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Importe por orden" hint="moneda quote">
        <input className="form-input" type="number" step="any" min="1" value={p.amount_per_order}
          onChange={e => set({ ...p, amount_per_order: +e.target.value })} />
      </Field>
      <Field label="Intervalo (días)">
        <input className="form-input" type="number" min="1" max="90" value={p.interval_days}
          onChange={e => set({ ...p, interval_days: +e.target.value })} />
      </Field>
    </div>
  );
}

function GridParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Precio mínimo">
        <input className="form-input" type="number" step="any" value={p.lower_price}
          onChange={e => set({ ...p, lower_price: +e.target.value })} />
      </Field>
      <Field label="Precio máximo">
        <input className="form-input" type="number" step="any" value={p.upper_price}
          onChange={e => set({ ...p, upper_price: +e.target.value })} />
      </Field>
      <Field label="Niveles de grid">
        <input className="form-input" type="number" min="2" max="20" value={p.grid_levels}
          onChange={e => set({ ...p, grid_levels: +e.target.value })} />
      </Field>
      <Field label="Importe/nivel" hint="quote">
        <input className="form-input" type="number" step="any" value={p.amount_per_grid}
          onChange={e => set({ ...p, amount_per_grid: +e.target.value })} />
      </Field>
    </div>
  );
}

function SignalParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI sobrevendido">
        <input className="form-input" type="number" min="10" max="45" value={p.rsi_oversold}
          onChange={e => set({ ...p, rsi_oversold: +e.target.value })} />
      </Field>
      <Field label="RSI sobrecomprado">
        <input className="form-input" type="number" min="55" max="90" value={p.rsi_overbought}
          onChange={e => set({ ...p, rsi_overbought: +e.target.value })} />
      </Field>
      <Field label="Importe por operación" hint="quote">
        <input className="form-input" type="number" step="any" value={p.amount_per_trade}
          onChange={e => set({ ...p, amount_per_trade: +e.target.value })} />
      </Field>
    </div>
  );
}

function MarketMakingParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Spread (%)" hint="total bid-ask">
        <input className="form-input" type="number" step="0.1" min="0.1" value={p.spread_pct}
          onChange={e => set({ ...p, spread_pct: +e.target.value })} />
      </Field>
      <Field label="Tamaño orden (% capital)">
        <input className="form-input" type="number" step="1" min="1" max="50" value={p.order_size_pct}
          onChange={e => set({ ...p, order_size_pct: +e.target.value })} />
      </Field>
      <Field label="Inventario máx (% capital)">
        <input className="form-input" type="number" step="5" min="5" max="80" value={p.max_inventory_pct}
          onChange={e => set({ ...p, max_inventory_pct: +e.target.value })} />
      </Field>
    </div>
  );
}

function ArbitrageParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Spread mínimo (%)" hint="para ejecutar">
        <input className="form-input" type="number" step="0.05" min="0.05" value={p.min_spread_pct}
          onChange={e => set({ ...p, min_spread_pct: +e.target.value })} />
      </Field>
      <Field label="Capital por arb." hint="quote">
        <input className="form-input" type="number" step="any" min="1" value={p.amount_per_trade}
          onChange={e => set({ ...p, amount_per_trade: +e.target.value })} />
      </Field>
    </div>
  );
}

function ScalpingParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI entrada" hint="máx para comprar">
        <input className="form-input" type="number" min="20" max="60" value={p.rsi_entry}
          onChange={e => set({ ...p, rsi_entry: +e.target.value })} />
      </Field>
      <Field label="Capital por trade" hint="quote">
        <input className="form-input" type="number" step="any" min="1" value={p.amount_per_trade}
          onChange={e => set({ ...p, amount_per_trade: +e.target.value })} />
      </Field>
      <Field label="Take Profit (%)">
        <input className="form-input" type="number" step="0.1" min="0.1" value={p.take_profit_pct}
          onChange={e => set({ ...p, take_profit_pct: +e.target.value })} />
      </Field>
      <Field label="Stop Loss (%)">
        <input className="form-input" type="number" step="0.05" min="0.05" value={p.stop_loss_pct}
          onChange={e => set({ ...p, stop_loss_pct: +e.target.value })} />
      </Field>
    </div>
  );
}

function MeanReversionParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Capital por trade" hint="quote">
        <input className="form-input" type="number" step="any" min="1" value={p.amount_per_trade}
          onChange={e => set({ ...p, amount_per_trade: +e.target.value })} />
      </Field>
      <Field label="Stop Loss (%)">
        <input className="form-input" type="number" step="0.5" min="0.5" value={p.stop_loss_pct}
          onChange={e => set({ ...p, stop_loss_pct: +e.target.value })} />
      </Field>
      {p.rsi_confirm && (
        <Field label="RSI sobrevendido" hint="confirmación">
          <input className="form-input" type="number" min="10" max="50" value={p.rsi_oversold}
            onChange={e => set({ ...p, rsi_oversold: +e.target.value })} />
        </Field>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!p.rsi_confirm} onChange={e => set({ ...p, rsi_confirm: e.target.checked })} />
          Confirmar entrada con RSI
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!p.exit_at_mean} onChange={e => set({ ...p, exit_at_mean: e.target.checked })} />
          {p.exit_at_mean ? 'Salir en la media (SMA20)' : 'Salir en banda superior'}
        </label>
      </div>
    </div>
  );
}

function MomentumParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI mínimo entrada">
        <input className="form-input" type="number" min="50" max="70" value={p.rsi_min}
          onChange={e => set({ ...p, rsi_min: +e.target.value })} />
      </Field>
      <Field label="RSI máximo entrada">
        <input className="form-input" type="number" min="60" max="85" value={p.rsi_max}
          onChange={e => set({ ...p, rsi_max: +e.target.value })} />
      </Field>
      <Field label="Capital por trade" hint="quote">
        <input className="form-input" type="number" step="any" min="1" value={p.amount_per_trade}
          onChange={e => set({ ...p, amount_per_trade: +e.target.value })} />
      </Field>
      <Field label="Take Profit (%)">
        <input className="form-input" type="number" step="0.5" min="0.5" value={p.take_profit_pct}
          onChange={e => set({ ...p, take_profit_pct: +e.target.value })} />
      </Field>
      <Field label="Stop Loss (%)">
        <input className="form-input" type="number" step="0.5" min="0.5" value={p.stop_loss_pct}
          onChange={e => set({ ...p, stop_loss_pct: +e.target.value })} />
      </Field>
      <Field label="Trailing Stop (%)">
        <input className="form-input" type="number" step="0.25" min="0.25" value={p.trailing_stop_pct}
          onChange={e => set({ ...p, trailing_stop_pct: +e.target.value })} />
      </Field>
    </div>
  );
}

function IADynamicParams({ p, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Capital por posición" hint="quote">
        <input className="form-input" type="number" step="any" min="1" value={p.capital_per_position}
          onChange={e => set({ ...p, capital_per_position: +e.target.value })} />
      </Field>
      <Field label="Puntuación mínima" hint="1–3 indicadores">
        <input className="form-input" type="number" min="1" max="3" value={p.min_score}
          onChange={e => set({ ...p, min_score: +e.target.value })} />
      </Field>
      <Field label="RSI sobrevendido (compra)">
        <input className="form-input" type="number" min="10" max="50" value={p.rsi_oversold}
          onChange={e => set({ ...p, rsi_oversold: +e.target.value })} />
      </Field>
      <Field label="RSI sobrecomprado (venta)">
        <input className="form-input" type="number" min="50" max="90" value={p.rsi_overbought}
          onChange={e => set({ ...p, rsi_overbought: +e.target.value })} />
      </Field>
    </div>
  );
}

function SummaryCard({ label, value, sub, color = '#38bdf8', big = false }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: big ? '1.6rem' : '1.3rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--ts)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CompareBar({ strategyPct, bhPct }) {
  const max = Math.max(Math.abs(strategyPct), Math.abs(bhPct), 5);
  const sColor = strategyPct >= 0 ? '#38bdf8' : '#f87171';
  const bColor = bhPct >= 0 ? '#a78bfa' : '#f87171';
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.75rem' }}>
        ESTRATEGIA VS BUY & HOLD
      </div>
      {[
        { label: 'Estrategia', pct: strategyPct, color: sColor },
        { label: 'Buy & Hold', pct: bhPct,       color: bColor },
      ].map(({ label, pct, color }) => (
        <div key={label} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
            <span style={{ color: 'var(--ts)' }}>{label}</span>
            <span style={{ color, fontWeight: 700 }}>{pct >= 0 ? '+' : ''}{pct?.toFixed(2)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bd)', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4, background: color,
              width: `${Math.min(100, Math.abs(pct) / max * 100)}%`,
              marginLeft: pct < 0 ? 'auto' : 0, transition: 'width 0.5s',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Backtest() {
  const [exchange, setExchange]     = useState('kraken');
  const [symbol, setSymbol]         = useState('BTC/EUR');
  const [strategy, setStrategy]     = useState('dca');
  const [period, setPeriod]         = useState('3m');
  const [capital, setCapital]       = useState(1000);
  const [params, setParams]         = useState({ amount_per_order: 100, interval_days: 7 });
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [showAll, setShowAll]       = useState(false);

  const symbols = SYMBOLS_BY_EXCHANGE[exchange] || [];

  const handleExchangeChange = (ex) => {
    setExchange(ex);
    const syms = SYMBOLS_BY_EXCHANGE[ex] || [];
    setSymbol(syms[0] || '');
  };

  const handleStrategyChange = (s) => {
    setStrategy(s);
    const c = capital;
    if (s === 'dca')           setParams({ amount_per_order: c * 0.1, interval_days: 7 });
    if (s === 'grid')          setParams({ lower_price: 0, upper_price: 0, grid_levels: 5, amount_per_grid: c / 10 });
    if (s === 'signal')        setParams({ rsi_oversold: 30, rsi_overbought: 70, amount_per_trade: c * 0.5 });
    if (s === 'ia_dynamic')    setParams({ capital_per_position: c * 0.2, min_score: 2, rsi_oversold: 35, rsi_overbought: 65 });
    if (s === 'market_making') setParams({ spread_pct: 0.5, order_size_pct: 10, max_inventory_pct: 30 });
    if (s === 'arbitrage')     setParams({ min_spread_pct: 0.3, amount_per_trade: c * 0.1 });
    if (s === 'scalping')      setParams({ rsi_entry: 45, take_profit_pct: 0.5, stop_loss_pct: 0.3, amount_per_trade: c * 0.5 });
    if (s === 'mean_reversion') setParams({ amount_per_trade: c * 0.5, stop_loss_pct: 3.0, rsi_oversold: 35, rsi_confirm: true, exit_at_mean: true });
    if (s === 'momentum')      setParams({ rsi_min: 55, rsi_max: 75, take_profit_pct: 3.0, stop_loss_pct: 2.0, trailing_stop_pct: 1.5, amount_per_trade: c * 0.5 });
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null); setShowAll(false);
    try {
      const r = await backtestApi.run({ exchange, symbol, strategy, period, initial_capital: capital, params });
      setResult(r);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const r = result?.resumen;
  const trades = result?.operaciones || [];
  const visibleTrades = showAll ? trades : trades.slice(0, 20);

  return (
    <div>
      <h1 className="page-title">Backtesting</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Formulario ─────────────────────────────────────────────────────── */}
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <form onSubmit={handleRun}>
            <Field label="Exchange">
              <select className="form-select" value={exchange} onChange={e => handleExchangeChange(e.target.value)}>
                {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
              </select>
            </Field>

            <Field label="Par">
              <select className="form-select" value={symbol} onChange={e => setSymbol(e.target.value)}>
                {symbols.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Estrategia">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {STRATEGIES.map(s => {
                  const col = STRATEGY_COLOR[s.id] || '#38bdf8';
                  const active = strategy === s.id;
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.75rem', borderRadius: 6, cursor: 'pointer',
                      background: active ? col + '15' : 'var(--bg)',
                      border: `1px solid ${active ? col : 'var(--bd)'}` }}>
                      <input type="radio" name="strategy" value={s.id} checked={active}
                        onChange={() => handleStrategyChange(s.id)} style={{ accentColor: col }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.83rem', color: active ? col : 'var(--tx)' }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--td)' }}>{s.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="Periodo">
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {PERIODS.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setPeriod(p.id)}
                    className="btn"
                    style={{ flex: 1, fontSize: '0.78rem',
                      background: period === p.id ? '#0284c7' : 'var(--su)',
                      color: period === p.id ? 'white' : 'var(--ts)',
                      border: '1px solid #334155', padding: '0.4rem 0' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Capital inicial">
              <input className="form-input" type="number" min="10" step="any" value={capital}
                onChange={e => setCapital(+e.target.value)} />
            </Field>

            <div style={{ borderTop: '1px solid #334155', paddingTop: '0.875rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.5rem' }}>
                PARÁMETROS DE LA ESTRATEGIA
              </div>
              {strategy === 'dca'            && <DCAParams          p={params} set={setParams} />}
              {strategy === 'grid'           && <GridParams         p={params} set={setParams} />}
              {strategy === 'signal'         && <SignalParams        p={params} set={setParams} />}
              {strategy === 'ia_dynamic'     && <IADynamicParams     p={params} set={setParams} />}
              {strategy === 'market_making'  && <MarketMakingParams  p={params} set={setParams} />}
              {strategy === 'arbitrage'      && <ArbitrageParams     p={params} set={setParams} />}
              {strategy === 'scalping'       && <ScalpingParams      p={params} set={setParams} />}
              {strategy === 'mean_reversion' && <MeanReversionParams p={params} set={setParams} />}
              {strategy === 'momentum'       && <MomentumParams      p={params} set={setParams} />}
            </div>

            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.9rem', padding: '0.7rem' }}
              disabled={loading}>
              {loading ? 'Calculando...' : '▶ Ejecutar Backtest'}
            </button>
          </form>
        </div>

        {/* ── Resultados ─────────────────────────────────────────────────────── */}
        <div>
          {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="loading">Simulando {PERIODS.find(p => p.id === period)?.label} de operaciones...</div>
            </div>
          )}

          {result && r && (
            <>
              {/* Cabecera */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--td)' }}>
                  {result.symbol} · {result.exchange} · {STRATEGIES.find(s => s.id === result.strategy)?.label} ·{' '}
                  {r.periodo_inicio} → {r.periodo_fin} · {r.num_velas} velas
                </div>
              </div>

              {/* Cards principales */}
              <div className="grid-4" style={{ marginBottom: '1rem' }}>
                <SummaryCard
                  label="Capital final"
                  value={`€${r.capital_final?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  sub={`Inicial: €${r.capital_inicial?.toLocaleString('es-ES')}`}
                  color={r.capital_final >= r.capital_inicial ? '#4ade80' : '#f87171'}
                  big
                />
                <SummaryCard
                  label="Rentabilidad"
                  value={`${r.rentabilidad_pct >= 0 ? '+' : ''}${r.rentabilidad_pct?.toFixed(2)}%`}
                  sub={`${r.rentabilidad_eur >= 0 ? '+' : ''}€${r.rentabilidad_eur?.toFixed(2)}`}
                  color={r.rentabilidad_pct >= 0 ? '#4ade80' : '#f87171'}
                />
                <SummaryCard
                  label="Operaciones"
                  value={r.num_operaciones}
                  sub={r.operaciones_cerradas > 0 ? `${r.win_rate}% ganadas` : undefined}
                  color="#38bdf8"
                />
                <SummaryCard
                  label="vs Buy & Hold"
                  value={`${(r.rentabilidad_pct - r.buy_hold_pct) >= 0 ? '+' : ''}${(r.rentabilidad_pct - r.buy_hold_pct).toFixed(2)}pp`}
                  sub={`B&H: ${r.buy_hold_pct >= 0 ? '+' : ''}${r.buy_hold_pct?.toFixed(2)}%`}
                  color={(r.rentabilidad_pct - r.buy_hold_pct) >= 0 ? '#4ade80' : '#f59e0b'}
                />
              </div>

              {/* Mejor / Peor operación */}
              {(r.mejor_operacion || r.peor_operacion) && (
                <div className="grid-2" style={{ marginBottom: '1rem' }}>
                  {r.mejor_operacion && (
                    <div className="card" style={{ borderLeft: '3px solid #4ade80' }}>
                      <div style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 600, marginBottom: 4 }}>MEJOR OPERACIÓN</div>
                      <div style={{ fontWeight: 700, color: '#4ade80' }}>+€{r.mejor_operacion.pnl?.toFixed(2)} (+{r.mejor_operacion.pnl_pct?.toFixed(2)}%)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--td)' }}>{r.mejor_operacion.fecha} · €{r.mejor_operacion.precio?.toLocaleString()}</div>
                    </div>
                  )}
                  {r.peor_operacion && (
                    <div className="card" style={{ borderLeft: '3px solid #f87171' }}>
                      <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 600, marginBottom: 4 }}>PEOR OPERACIÓN</div>
                      <div style={{ fontWeight: 700, color: '#f87171' }}>€{r.peor_operacion.pnl?.toFixed(2)} ({r.peor_operacion.pnl_pct?.toFixed(2)}%)</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--td)' }}>{r.peor_operacion.fecha} · €{r.peor_operacion.precio?.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Barra comparativa */}
              <CompareBar strategyPct={r.rentabilidad_pct} bhPct={r.buy_hold_pct} />

              {/* Gráfico */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  EVOLUCIÓN DEL CAPITAL — Estrategia vs Buy & Hold
                </div>
                <BacktestChart data={result.curva_capital} initialCapital={r.capital_inicial} />
              </div>

              {/* Tabla de operaciones */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600 }}>
                    OPERACIONES SIMULADAS ({trades.length})
                  </div>
                  {trades.length > 20 && (
                    <button className="btn" style={{ fontSize: '0.75rem', background: 'var(--su)', color: 'var(--ts)', border: '1px solid #334155' }}
                      onClick={() => setShowAll(v => !v)}>
                      {showAll ? 'Mostrar menos' : `Ver todas (${trades.length})`}
                    </button>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Fecha</th><th>Tipo</th><th>Precio</th>
                        <th>Cantidad</th><th>Importe</th><th>P&L</th><th>P&L %</th>
                        {trades[0]?.rsi    !== undefined && <th>RSI</th>}
                        {trades[0]?.motivo !== undefined && <th>Motivo</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTrades.map((t, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--td)' }}>{t.fecha}</td>
                          <td style={{ color: t.tipo === 'compra' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                            {t.tipo === 'compra' ? 'COMPRA' : 'VENTA'}
                          </td>
                          <td>€{t.precio?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                          <td>{t.cantidad?.toFixed(6)}</td>
                          <td>€{t.importe?.toFixed(2)}</td>
                          <td style={{ color: t.pnl == null ? 'var(--td)' : t.pnl >= 0 ? '#4ade80' : '#f87171', fontWeight: t.pnl != null ? 600 : 400 }}>
                            {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}€${t.pnl.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ color: t.pnl_pct == null ? 'var(--td)' : t.pnl_pct >= 0 ? '#4ade80' : '#f87171' }}>
                            {t.pnl_pct != null ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%` : '—'}
                          </td>
                          {trades[0]?.rsi    !== undefined && <td style={{ color: 'var(--td)' }}>{t.rsi ?? '—'}</td>}
                          {trades[0]?.motivo !== undefined && <td style={{ color: 'var(--td)', fontSize: '0.72rem' }}>{t.motivo ?? '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!result && !loading && !error && (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <div style={{ color: 'var(--td)' }}>Configura los parámetros y ejecuta el backtest para ver los resultados.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
