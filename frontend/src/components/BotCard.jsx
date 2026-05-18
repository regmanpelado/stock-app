import React, { useState } from 'react';
import { botsApi } from '../services/api.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { toEUR, fmtEUR, quoteOf } from '../utils/currency.js';

const STATUS_STYLE = {
  running: { color: '#4ade80', bg: '#14532d', label: 'Activo' },
  paused:  { color: '#f59e0b', bg: '#78350f', label: 'Pausado' },
  stopped: { color: '#94a3b8', bg: '#1e293b', label: 'Detenido' },
  error:   { color: '#f87171', bg: '#450a0a', label: 'Error' },
};

const TYPE_LABEL = { dca: 'DCA', grid: 'Grid', signal: 'Señal', ia_dynamic: 'IA Dinámico', market_making: 'Market Making', arbitrage: 'Arbitraje', scalping: 'Scalping', mean_reversion: 'Mean Reversion', momentum: 'Momentum', funding_arb: 'Funding Arb' };
const TYPE_COLOR = { dca: '#38bdf8', grid: '#a78bfa', signal: '#fb923c', ia_dynamic: '#34d399', market_making: '#f59e0b', arbitrage: '#e879f9', scalping: '#f43f5e', mean_reversion: '#06b6d4', momentum: '#84cc16', funding_arb: '#f97316' };

function PnL({ value, pct, quote, eurUsd }) {
  const eur = toEUR(value, quote, eurUsd) ?? value;
  const pos = eur >= 0;
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: pos ? '#4ade80' : '#f87171' }}>
        {pos ? '+' : ''}{fmtEUR(eur)}
      </div>
      <div style={{ fontSize: '0.72rem', color: pos ? '#4ade80' : '#f87171' }}>
        {pos ? '+' : ''}{pct?.toFixed(2) ?? '0.00'}%
      </div>
    </div>
  );
}

function StatsBlock({ bot }) {
  const { type, stats, config } = bot;
  if (type === 'dca') return (
    <div style={gridStyle}>
      <Stat label="Órdenes"    value={stats.total_orders} />
      <Stat label="Cantidad"   value={`${stats.total_quantity?.toFixed(6)} ${config.symbol?.split('/')[0]}`} />
      <Stat label="Coste med." value={`$${stats.avg_cost?.toFixed(4) ?? '—'}`} />
      <Stat label="Intervalo"  value={`${config.interval_minutes} min`} />
    </div>
  );
  if (type === 'grid') {
    const profitPerCycle = stats.profit_per_cycle ?? 0;
    const efficiency     = stats.grid_efficiency  ?? 0;
    const trailCount     = stats.trail_count      ?? 0;
    const availProfit    = stats.available_profit ?? 0;
    return (
      <div style={gridStyle}>
        <Stat label="Niveles"      value={`${stats.levels?.filter(l => l.bought).length ?? 0} / ${stats.levels?.length ?? 0}`} />
        <Stat label="Ciclos"       value={stats.completed_cycles ?? 0} />
        <Stat label="P&L realizado" value={`$${(stats.realized_pnl ?? 0).toFixed(4)}`} />
        <Stat label="Benef./ciclo" value={`$${profitPerCycle.toFixed(4)}`} />
        <Stat label="Eficiencia"   value={`${efficiency.toFixed(1)}%`} />
        <Stat label="Rango"        value={`$${(config.lower_price ?? 0).toLocaleString()}–$${(config.upper_price ?? 0).toLocaleString()}`} />
        {trailCount > 0 && <Stat label="Trailing" value={`${trailCount}×`} />}
        {availProfit > 0 && <Stat label="Para reinvertir" value={`$${availProfit.toFixed(4)}`} />}
        {stats.dynamic_updated && (
          <Stat label="Grid dinámico" value={new Date(stats.dynamic_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        )}
        {stats.auto_paused && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#f59e0b',
            background: '#78350f33', borderRadius: 4, padding: '0.3rem 0.5rem', marginTop: '0.25rem' }}>
            ⏸ Auto-pausado: {stats.pause_reason}
          </div>
        )}
      </div>
    );
  }
  if (type === 'ia_dynamic') {
    const positions = stats.positions || {};
    const ranking   = (stats.ranking || []).slice(0, 3);
    const nPos = Object.keys(positions).length;
    return (
      <div style={gridStyle}>
        <Stat label="Posiciones" value={`${nPos} / ${config.max_positions || 3}`} />
        <Stat label="Escaneos"   value={stats.total_scans || 0} />
        <Stat label="Rotaciones" value={stats.rotations || 0} />
        <Stat label="P&L real."  value={`$${stats.realized_pnl?.toFixed(4) ?? '0'}`} />
        {ranking.length > 0 && (
          <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.3rem' }}>TOP PICKS</div>
            {ranking.map(r => (
              <div key={r.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '0.15rem 0' }}>
                <span style={{ color: nPos && positions[r.symbol] ? '#34d399' : '#94a3b8' }}>
                  {positions[r.symbol] ? '●' : '○'} {r.symbol}
                </span>
                <span style={{ color: r.score >= 2 ? '#34d399' : r.score < 0 ? '#f87171' : '#64748b', fontWeight: 600 }}>
                  {r.score > 0 ? '+' : ''}{r.score} · {r.tendencia_ia || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (type === 'signal') return (
    <div style={gridStyle}>
      <Stat label="Posición"  value={`${stats.position?.toFixed(6) ?? '0'} ${config.symbol?.split('/')[0]}`} />
      <Stat label="Compras"   value={stats.buy_signals} />
      <Stat label="Ventas"    value={stats.sell_signals} />
      <Stat label="Señal"     value={stats.last_signal?.signal ?? '—'} />
    </div>
  );
  if (type === 'market_making') {
    const base = config.symbol?.split('/')[0] ?? '';
    const bidStr = (stats.bid_prices || []).map(p => `$${p.toLocaleString()}`).join(' · ') || '—';
    const askStr = (stats.ask_prices || []).map(p => `$${p.toLocaleString()}`).join(' · ') || '—';
    return (
      <div style={gridStyle}>
        <Stat label="Fills totales"  value={stats.total_fills ?? 0} />
        <Stat label="Compras / Ventas" value={`${stats.buy_fills ?? 0} / ${stats.sell_fills ?? 0}`} />
        <Stat label="Inventario" value={`${stats.current_inventory?.toFixed(6) ?? '0'} ${base}`} />
        <Stat label="Spread ganado"  value={`$${stats.spread_earned?.toFixed(4) ?? '0'}`} />
        <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.2rem' }}>BIDS virtuales</div>
          <div style={{ fontSize: '0.72rem', color: '#4ade80' }}>{bidStr}</div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', margin: '0.2rem 0' }}>ASKS virtuales</div>
          <div style={{ fontSize: '0.72rem', color: '#f87171' }}>{askStr}</div>
        </div>
      </div>
    );
  }
  if (type === 'momentum') {
    const score      = stats.momentum_score ?? 0;
    const inPosition = (stats.position ?? 0) > 0;
    const last       = stats.last_trade;
    const scoreColor = score >= 70 ? '#84cc16' : score >= 40 ? '#f59e0b' : '#64748b';
    const signalColor = { 'en posición': '#84cc16', 'compra': '#4ade80', 'salida': '#f87171', 'neutral': '#64748b' };
    const drawdownPct = inPosition && stats.peak_price && stats.entry_price
      ? ((stats.peak_price - (bot.current_value / (stats.position || 1))) / stats.peak_price * 100)
      : null;
    return (
      <div style={gridStyle}>
        <Stat label="Trades"      value={stats.total_trades ?? 0} />
        <Stat label="Win Rate"    value={
          <span style={{ color: (stats.win_rate ?? 0) >= 50 ? '#4ade80' : '#f87171' }}>
            {(stats.win_rate ?? 0).toFixed(1)}%
          </span>
        } />
        <Stat label="Profit medio" value={
          <span style={{ color: (stats.avg_profit_pct ?? 0) >= 0 ? '#4ade80' : '#f87171' }}>
            {(stats.avg_profit_pct ?? 0) >= 0 ? '+' : ''}{(stats.avg_profit_pct ?? 0).toFixed(3)}%
          </span>
        } />
        <Stat label="Señal" value={
          <span style={{ color: signalColor[stats.current_signal] ?? '#64748b', fontWeight: 700 }}>
            {stats.current_signal ?? 'neutral'}
          </span>
        } />
        {/* Barra de momentum score */}
        <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginBottom: '0.2rem' }}>
            <span>Momentum score</span>
            <span style={{ color: scoreColor, fontWeight: 700 }}>{score.toFixed(0)} / 90</span>
          </div>
          <div style={{ height: 6, background: '#1e293b', borderRadius: 3, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(score / 90) * 100}%`, background: scoreColor, borderRadius: 3,
              transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#475569', marginTop: '0.15rem' }}>
            <span>RSI {stats.last_rsi != null ? stats.last_rsi.toFixed(1) : '—'}</span>
            <span>MACD hist {stats.last_macd_hist != null ? (stats.last_macd_hist > 0 ? '+' : '') + stats.last_macd_hist.toFixed(4) : '—'}</span>
          </div>
        </div>
        {inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#84cc16',
            background: '#365314' + '33', borderRadius: 4, padding: '0.3rem 0.5rem' }}>
            En posición · entrada ${(stats.entry_price ?? 0).toLocaleString()} · pico ${(stats.peak_price ?? 0).toLocaleString()}
          </div>
        )}
        {last && !inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.71rem', color: '#94a3b8',
            background: '#0f172a', borderRadius: 4, padding: '0.3rem 0.5rem' }}>
            Último: ${last.entry?.toLocaleString()} → ${last.exit?.toLocaleString()}
            {' · '}<span style={{ color: last.pnl >= 0 ? '#4ade80' : '#f87171' }}>
              {last.pnl >= 0 ? '+' : ''}{last.pnl_pct?.toFixed(3)}%
            </span>
            {' · '}{last.reason}
          </div>
        )}
      </div>
    );
  }
  if (type === 'mean_reversion') {
    const inPosition  = (stats.position ?? 0) > 0;
    const pctB        = stats.pct_b;           // 0=banda inf, 50=media, 100=banda sup
    const deviation   = stats.deviation_pct ?? 0;
    const signalColor = { 'en posición': '#06b6d4', 'compra': '#4ade80', 'salida': '#f87171', 'neutral': '#64748b' };
    const last        = stats.last_trade;
    // barra visual: verde en zona baja, gris en media, rojo en zona alta
    const barPct = pctB != null ? Math.max(0, Math.min(100, pctB)) : 50;
    const barColor = barPct < 30 ? '#4ade80' : barPct > 70 ? '#f87171' : '#f59e0b';
    return (
      <div style={gridStyle}>
        <Stat label="Trades"      value={stats.total_trades ?? 0} />
        <Stat label="Win Rate"    value={
          <span style={{ color: (stats.win_rate ?? 0) >= 50 ? '#4ade80' : '#f87171' }}>
            {(stats.win_rate ?? 0).toFixed(1)}%
          </span>
        } />
        <Stat label="Profit medio" value={
          <span style={{ color: (stats.avg_profit_pct ?? 0) >= 0 ? '#4ade80' : '#f87171' }}>
            {(stats.avg_profit_pct ?? 0) >= 0 ? '+' : ''}{(stats.avg_profit_pct ?? 0).toFixed(3)}%
          </span>
        } />
        <Stat label="Señal" value={
          <span style={{ color: signalColor[stats.current_signal] ?? '#64748b', fontWeight: 700 }}>
            {stats.current_signal ?? 'neutral'}
          </span>
        } />
        {/* Barra de posición en las Bollinger Bands */}
        {pctB != null && (
          <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginBottom: '0.2rem' }}>
              <span>Banda inf. ${(stats.bb_lower ?? 0).toLocaleString()}</span>
              <span>Media ${(stats.bb_middle ?? 0).toLocaleString()}</span>
              <span>Banda sup. ${(stats.bb_upper ?? 0).toLocaleString()}</span>
            </div>
            <div style={{ height: 6, background: '#1e293b', borderRadius: 3, position: 'relative', border: '1px solid #334155' }}>
              <div style={{ position: 'absolute', left: `${barPct}%`, top: -2, width: 10, height: 10,
                background: barColor, borderRadius: '50%', transform: 'translateX(-50%)', border: '2px solid #0f172a' }} />
            </div>
            <div style={{ fontSize: '0.68rem', color: barColor, textAlign: 'center', marginTop: '0.2rem' }}>
              %B: {pctB.toFixed(1)} · desv. {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%
            </div>
          </div>
        )}
        {inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#06b6d4',
            background: '#0e7490' + '22', borderRadius: 4, padding: '0.3rem 0.5rem' }}>
            En posición · entrada ${(stats.entry_price ?? 0).toLocaleString()} · RSI {stats.last_rsi ?? '—'}
          </div>
        )}
        {last && !inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.71rem', color: '#94a3b8',
            background: '#0f172a', borderRadius: 4, padding: '0.3rem 0.5rem' }}>
            Último: ${last.entry?.toLocaleString()} → ${last.exit?.toLocaleString()}
            {' · '}<span style={{ color: last.pnl >= 0 ? '#4ade80' : '#f87171' }}>
              {last.pnl >= 0 ? '+' : ''}{last.pnl_pct?.toFixed(3)}%
            </span>
            {' · '}{last.reason}
          </div>
        )}
      </div>
    );
  }
  if (type === 'scalping') {
    const last       = stats.last_trade;
    const inPosition = (stats.position ?? 0) > 0;
    const signalColor = { 'en posición': '#f59e0b', 'compra': '#4ade80', 'salida': '#f87171', 'neutral': '#64748b' };
    return (
      <div style={gridStyle}>
        <Stat label="Trades" value={stats.total_trades ?? 0} />
        <Stat label="Win Rate" value={
          <span style={{ color: (stats.win_rate ?? 0) >= 50 ? '#4ade80' : '#f87171' }}>
            {(stats.win_rate ?? 0).toFixed(1)}%
          </span>
        } />
        <Stat label="Ganados / Perdidos" value={`${stats.winning_trades ?? 0} / ${stats.losing_trades ?? 0}`} />
        <Stat label="Profit medio" value={
          <span style={{ color: (stats.avg_profit_pct ?? 0) >= 0 ? '#4ade80' : '#f87171' }}>
            {(stats.avg_profit_pct ?? 0) >= 0 ? '+' : ''}{(stats.avg_profit_pct ?? 0).toFixed(3)}%
          </span>
        } />
        <Stat label="RSI actual" value={stats.last_rsi != null ? stats.last_rsi.toFixed(1) : '—'} />
        <Stat label="Señal" value={
          <span style={{ color: signalColor[stats.current_signal] ?? '#64748b', fontWeight: 700 }}>
            {stats.current_signal ?? 'neutral'}
          </span>
        } />
        {inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: '#f59e0b',
            background: '#78350f22', borderRadius: 4, padding: '0.3rem 0.5rem', marginTop: '0.1rem' }}>
            En posición · entrada ${(stats.entry_price ?? 0).toLocaleString()} · {config.symbol?.split('/')[0]} {(stats.position ?? 0).toFixed(6)}
          </div>
        )}
        {last && !inPosition && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.71rem', color: '#94a3b8',
            background: '#0f172a', borderRadius: 4, padding: '0.3rem 0.5rem', marginTop: '0.1rem' }}>
            Último: entrada ${last.entry?.toLocaleString()} → salida ${last.exit?.toLocaleString()}
            {' · '}<span style={{ color: last.pnl >= 0 ? '#4ade80' : '#f87171' }}>
              {last.pnl >= 0 ? '+' : ''}{last.pnl_pct?.toFixed(3)}%
            </span>
            {' · '}{last.reason}
          </div>
        )}
      </div>
    );
  }
  if (type === 'arbitrage') {
    const spread     = stats.current_spread_pct ?? 0;
    const minSpread  = config.min_spread_pct ?? 0.3;
    const spreadColor = spread >= minSpread ? '#4ade80' : '#94a3b8';
    const last       = stats.last_opportunity;
    return (
      <div style={gridStyle}>
        <Stat label={`Precio ${(config.exchange_a ?? '').toUpperCase()}`} value={`$${(stats.price_a ?? 0).toLocaleString()}`} />
        <Stat label={`Precio ${(config.exchange_b ?? '').toUpperCase()}`} value={`$${(stats.price_b ?? 0).toLocaleString()}`} />
        <Stat label="Spread actual"     value={<span style={{ color: spreadColor }}>{spread.toFixed(3)}%</span>} />
        <Stat label="Mejor spread"      value={`${(stats.best_spread_pct ?? 0).toFixed(3)}%`} />
        <Stat label="Oportunidades"     value={stats.opportunities_found ?? 0} />
        <Stat label="Trades ejecutados" value={stats.trades_executed ?? 0} />
        {last && (
          <div style={{ gridColumn: '1 / -1', fontSize: '0.71rem', color: '#94a3b8',
            background: '#0f172a', borderRadius: 4, padding: '0.3rem 0.5rem', marginTop: '0.1rem' }}>
            Última: compra {last.buy_ex} <span style={{ color: '#4ade80' }}>${last.buy_price?.toLocaleString()}</span>
            {' → '}venta {last.sell_ex} <span style={{ color: '#f87171' }}>${last.sell_price?.toLocaleString()}</span>
            {' · '}spread {last.spread_pct?.toFixed(3)}%
            {' · '}P&L <span style={{ color: last.profit >= 0 ? '#4ade80' : '#f87171' }}>${last.profit?.toFixed(4)}</span>
          </div>
        )}
      </div>
    );
  }
  if (type === 'funding_arb') {
    const rate    = stats.last_funding_rate_pct ?? 0;
    const annual  = stats.annualized_yield_pct  ?? 0;
    const funding = stats.total_funding_collected ?? 0;
    const payments = (stats.funding_payments || []).length;
    return (
      <div style={gridStyle}>
        <Stat label="Funding rate"   value={`${rate >= 0 ? '+' : ''}${rate.toFixed(4)}% / 8h`} />
        <Stat label="APY estimado"   value={`${annual.toFixed(2)}% / año`} />
        <Stat label="Funding cobrado" value={`$${funding.toFixed(4)}`} />
        <Stat label="Pagos recibidos" value={payments} />
        {stats.position_open && (
          <Stat label="Posición"     value={stats.direction === 'long_spot_short_perp' ? 'Long spot / Short perp' : 'Short spot / Long perp'} />
        )}
        {stats.last_exit && (
          <Stat label="Último cierre" value={stats.last_exit.reason} />
        )}
      </div>
    );
  }
  return null;
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{value ?? '—'}</div>
    </div>
  );
}

const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '0.75rem' };

export default function BotCard({ bot, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { eurUsd } = useCurrency();
  const quote = quoteOf(bot.config?.symbol || '');

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); await onRefresh(); } finally { setBusy(false); }
  };

  const ss = STATUS_STYLE[bot.status] || STATUS_STYLE.stopped;
  const isRunning = bot.status === 'running';
  const isPaused  = bot.status === 'paused';
  const isStopped = bot.status === 'stopped' || bot.status === 'error';

  return (
    <div className="card" style={{ borderLeft: `3px solid ${TYPE_COLOR[bot.type]}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
              borderRadius: 4, background: TYPE_COLOR[bot.type] + '22', color: TYPE_COLOR[bot.type] }}>
              {TYPE_LABEL[bot.type]}
            </span>
            {bot.sandbox && (
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4,
                background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>
                SANDBOX
              </span>
            )}
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 4,
              background: ss.bg, color: ss.color }}>
              {ss.label}
            </span>
          </div>
          <div style={{ fontWeight: 700 }}>{bot.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {bot.type === 'arbitrage'
              ? `${bot.config.exchange_a} ↔ ${bot.config.exchange_b} · ${bot.config.symbol}`
              : `${bot.config.exchange} · ${bot.config.symbol}`}
          </div>
        </div>
        <PnL value={bot.pnl} pct={bot.pnl_pct} quote={quote} eurUsd={eurUsd} />
      </div>

      {/* Error */}
      {bot.error && (
        <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#450a0a',
          borderRadius: 4, fontSize: '0.75rem', color: '#fca5a5' }}>
          {bot.error}
        </div>
      )}

      {/* Stats */}
      <StatsBlock bot={bot} />

      {/* Controles */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
        {isStopped  && <button className="btn btn-success" style={{ flex: 1, fontSize: '0.8rem' }} disabled={busy} onClick={() => act(() => botsApi.start(bot.id))}>▶ Iniciar</button>}
        {isRunning  && <button className="btn" style={{ flex: 1, fontSize: '0.8rem', background: '#92400e', color: '#fcd34d' }} disabled={busy} onClick={() => act(() => botsApi.pause(bot.id))}>⏸ Pausar</button>}
        {isPaused   && <button className="btn btn-success" style={{ flex: 1, fontSize: '0.8rem' }} disabled={busy} onClick={() => act(() => botsApi.start(bot.id))}>▶ Reanudar</button>}
        {!isStopped && <button className="btn" style={{ flex: 1, fontSize: '0.8rem', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }} disabled={busy} onClick={() => act(() => botsApi.stop(bot.id))}>■ Detener</button>}
        <button className="btn" style={{ fontSize: '0.8rem', background: '#1e293b', color: '#64748b', border: '1px solid #334155' }}
          onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲' : '▼'}
        </button>
        <button className="btn" style={{ fontSize: '0.8rem', background: '#450a0a22', color: '#f87171', border: '1px solid #f8717133' }}
          disabled={busy} onClick={() => { if (confirm(`¿Eliminar bot "${bot.name}"?`)) act(() => botsApi.delete(bot.id)); }}>
          🗑
        </button>
      </div>

      {/* Historial expandido */}
      {expanded && (
        <div style={{ marginTop: '0.875rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>
            ÚLTIMAS OPERACIONES
          </div>
          {bot.trades.length === 0 ? (
            <div style={{ color: '#475569', fontSize: '0.8rem' }}>Sin operaciones aún</div>
          ) : (
            <table className="table" style={{ fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Hora</th><th>Lado</th><th>Precio</th><th>Cantidad</th><th>Coste</th>
                  {bot.sandbox && <th>Modo</th>}
                </tr>
              </thead>
              <tbody>
                {bot.trades.slice(0, 10).map(t => (
                  <tr key={t.id}>
                    <td style={{ color: '#64748b' }}>{new Date(t.timestamp).toLocaleTimeString()}</td>
                    <td style={{ color: t.side === 'buy' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                      {t.side === 'buy' ? 'COMPRA' : 'VENTA'}
                    </td>
                    <td>${t.price?.toLocaleString()}</td>
                    <td>{t.amount?.toFixed(6)}</td>
                    <td>${t.cost?.toFixed(4)}</td>
                    {bot.sandbox && <td style={{ color: '#94a3b8' }}>🧪</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.4rem' }}>
            Última actualización: {bot.last_check ? new Date(bot.last_check).toLocaleString() : '—'}
          </div>
        </div>
      )}
    </div>
  );
}
