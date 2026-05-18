import React, { useState } from 'react';
import { botsApi } from '../services/api.jsx';

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'gateio'];

const DEFAULTS = {
  dca:           { exchange: 'kraken', symbol: 'BTC/EUR', amount: 50, interval_minutes: 60, take_profit_pct: 5.0, stop_loss_pct: 10.0 },
  grid:          { exchange: 'binance', symbol: 'BTC/USDT', lower_price: 70000, upper_price: 90000, grid_levels: 5, amount_per_grid: 0.001, dynamic_grid: false, trailing_grid: false, trend_protection: false, trend_threshold_pct: 3.0, reinvest_profits: false },
  signal:        { exchange: 'binance', symbol: 'BTC/USDT', amount: 0.001, timeframe: '1h', use_rsi: true, use_macd: true, rsi_oversold: 30, rsi_overbought: 70, check_interval_minutes: 5 },
  ia_dynamic:    { exchange: 'binance', quote_currency: 'USDT', max_positions: 3, capital_per_position: 100, scan_interval_minutes: 60, min_score: 2, top_n_volume: 30, use_ai: true },
  market_making: { exchange: 'binance', symbol: 'BTC/USDT', spread_pct: 0.5, order_size: 0.001, levels: 1, refresh_interval: 30, max_inventory: 0.005 },
  arbitrage:     { exchange_a: 'binance', exchange_b: 'kraken', symbol: 'BTC/USDT', amount: 100, min_spread_pct: 0.3, check_interval: 10 },
  funding_arb:   { exchange: 'binance', symbol: 'BTCUSDT', amount_usdt: 100, min_funding_rate_pct: 0.01, check_interval_minutes: 30, auto_exit_on_negative: true  },
  scalping:      { exchange: 'binance', symbol: 'BTC/USDT', amount: 0.001, timeframe: '5m', take_profit_pct: 0.5, stop_loss_pct: 0.3, rsi_entry: 45, check_interval: 30, max_open_minutes: 60 },
  mean_reversion: { exchange: 'binance', symbol: 'BTC/USDT', amount: 0.001, timeframe: '1h', rsi_confirm: true, rsi_oversold: 35, exit_at_mean: true, stop_loss_pct: 3.0, check_interval_minutes: 15, max_open_hours: 48 },
  momentum:       { exchange: 'binance', symbol: 'BTC/USDT', amount: 0.001, timeframe: '1h', rsi_min: 55, rsi_max: 75, take_profit_pct: 3.0, stop_loss_pct: 2.0, trailing_stop_pct: 1.5, check_interval_minutes: 15, max_open_hours: 24 },
};

function Field({ label, hint, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{hint && <span style={{ color: '#475569', fontWeight: 400 }}> — {hint}</span>}</label>
      {children}
    </div>
  );
}

function DCAForm({ cfg, set }) {
  return <>
    <Field label="Exchange"><select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>{EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}</select></Field>
    <Field label="Par" hint="ej: BTC/USDT"><input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} /></Field>
    <Field label="Importe por orden" hint="en moneda quote (EUR, USDT, USD…)"><input className="form-input" type="number" step="any" min="1" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} /></Field>
    <Field label="Intervalo (minutos)"><input className="form-input" type="number" min="1" value={cfg.interval_minutes} onChange={e => set({ ...cfg, interval_minutes: +e.target.value })} /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Take profit %" hint="0 = desactivado">
        <input className="form-input" type="number" step="0.5" min="0" value={cfg.take_profit_pct}
          onChange={e => set({ ...cfg, take_profit_pct: +e.target.value })} />
      </Field>
      <Field label="Stop loss %" hint="0 = desactivado">
        <input className="form-input" type="number" step="0.5" min="0" value={cfg.stop_loss_pct}
          onChange={e => set({ ...cfg, stop_loss_pct: +e.target.value })} />
      </Field>
    </div>
    {(cfg.take_profit_pct > 0 || cfg.stop_loss_pct > 0) && (
      <div style={{ padding: '0.5rem 0.75rem', background: '#0c4a6e22', borderRadius: 6,
        fontSize: '0.75rem', color: '#94a3b8', marginTop: '-0.25rem' }}>
        Al alcanzar el objetivo el bot vende toda la posición acumulada y reinicia el ciclo de compras.
      </div>
    )}
  </>;
}

const AdvToggle = ({ label, desc, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
    <input type="checkbox" style={{ marginTop: 3 }} checked={checked} onChange={onChange} />
    <div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{desc}</div>
    </div>
  </label>
);

function GridForm({ cfg, set }) {
  return <>
    <Field label="Exchange"><select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>{EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}</select></Field>
    <Field label="Par"><input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Precio mínimo ($)"><input className="form-input" type="number" step="any" value={cfg.lower_price} onChange={e => set({ ...cfg, lower_price: +e.target.value })} /></Field>
      <Field label="Precio máximo ($)"><input className="form-input" type="number" step="any" value={cfg.upper_price} onChange={e => set({ ...cfg, upper_price: +e.target.value })} /></Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Niveles de grid"><input className="form-input" type="number" min="2" max="20" value={cfg.grid_levels} onChange={e => set({ ...cfg, grid_levels: +e.target.value })} /></Field>
      <Field label="Cantidad/nivel" hint="base"><input className="form-input" type="number" step="any" min="0" value={cfg.amount_per_grid} onChange={e => set({ ...cfg, amount_per_grid: +e.target.value })} /></Field>
    </div>

    <div style={{ borderTop: '1px solid #334155', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.6rem' }}>OPCIONES AVANZADAS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <AdvToggle
          label="Grid Dinámico"
          desc="Ajusta el rango automáticamente con Bollinger Bands (4h)"
          checked={!!cfg.dynamic_grid}
          onChange={e => set({ ...cfg, dynamic_grid: e.target.checked })}
        />
        <AdvToggle
          label="Grid Trailing"
          desc="Desplaza el grid hacia arriba cuando el precio supera el máximo"
          checked={!!cfg.trailing_grid}
          onChange={e => set({ ...cfg, trailing_grid: e.target.checked })}
        />
        <AdvToggle
          label="Protección de Tendencia"
          desc="Pausa automáticamente si el precio cae bruscamente bajo el mínimo"
          checked={!!cfg.trend_protection}
          onChange={e => set({ ...cfg, trend_protection: e.target.checked })}
        />
        {cfg.trend_protection && (
          <Field label="Umbral de caída (%)" hint="% bajo el mínimo para pausar">
            <input className="form-input" type="number" step="0.5" min="1" max="20"
              value={cfg.trend_threshold_pct ?? 3}
              onChange={e => set({ ...cfg, trend_threshold_pct: +e.target.value })} />
          </Field>
        )}
        <AdvToggle
          label="Reinversión de Beneficios"
          desc="Los beneficios de cada venta se añaden al siguiente lote de compra"
          checked={!!cfg.reinvest_profits}
          onChange={e => set({ ...cfg, reinvest_profits: e.target.checked })}
        />
      </div>
    </div>
  </>;
}

function SignalForm({ cfg, set }) {
  return <>
    <Field label="Exchange"><select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>{EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}</select></Field>
    <Field label="Par"><input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Cantidad" hint="base"><input className="form-input" type="number" step="any" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} /></Field>
      <Field label="Timeframe">
        <select className="form-select" value={cfg.timeframe} onChange={e => set({ ...cfg, timeframe: e.target.value })}>
          {['15m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
        </select>
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI sobrevendido"><input className="form-input" type="number" min="1" max="50" value={cfg.rsi_oversold} onChange={e => set({ ...cfg, rsi_oversold: +e.target.value })} /></Field>
      <Field label="RSI sobrecomprado"><input className="form-input" type="number" min="50" max="99" value={cfg.rsi_overbought} onChange={e => set({ ...cfg, rsi_overbought: +e.target.value })} /></Field>
    </div>
    <Field label="Intervalo de chequeo (min)"><input className="form-input" type="number" min="1" value={cfg.check_interval_minutes} onChange={e => set({ ...cfg, check_interval_minutes: +e.target.value })} /></Field>
    <div style={{ display: 'flex', gap: '1rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={cfg.use_rsi} onChange={e => set({ ...cfg, use_rsi: e.target.checked })} /> Usar RSI
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={cfg.use_macd} onChange={e => set({ ...cfg, use_macd: e.target.checked })} /> Usar MACD
      </label>
    </div>
  </>;
}

function IADynamicForm({ cfg, set }) {
  const QUOTES = ['USDT', 'EUR', 'USD', 'BTC'];
  return <>
    <Field label="Exchange"><select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>{EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}</select></Field>
    <Field label="Moneda de cotización" hint="filtra los pares analizados">
      <select className="form-select" value={cfg.quote_currency} onChange={e => set({ ...cfg, quote_currency: e.target.value })}>
        {QUOTES.map(q => <option key={q}>{q}</option>)}
      </select>
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Máx. posiciones" hint="3-5"><input className="form-input" type="number" min="1" max="10" value={cfg.max_positions} onChange={e => set({ ...cfg, max_positions: +e.target.value })} /></Field>
      <Field label="Capital/posición" hint="moneda quote"><input className="form-input" type="number" step="any" min="1" value={cfg.capital_per_position} onChange={e => set({ ...cfg, capital_per_position: +e.target.value })} /></Field>
      <Field label="Criptos a analizar"><input className="form-input" type="number" min="10" max="100" value={cfg.top_n_volume} onChange={e => set({ ...cfg, top_n_volume: +e.target.value })} /></Field>
      <Field label="Intervalo escaneo (min)"><input className="form-input" type="number" min="15" value={cfg.scan_interval_minutes} onChange={e => set({ ...cfg, scan_interval_minutes: +e.target.value })} /></Field>
      <Field label="Puntuación mínima" hint="1-5"><input className="form-input" type="number" min="0" max="8" value={cfg.min_score} onChange={e => set({ ...cfg, min_score: +e.target.value })} /></Field>
    </div>
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.25rem' }}>
      <input type="checkbox" checked={cfg.use_ai} onChange={e => set({ ...cfg, use_ai: e.target.checked })} />
      <span>Incluir predicción IA en la puntuación</span>
    </label>
  </>;
}

function MarketMakingForm({ cfg, set }) {
  return <>
    <Field label="Exchange"><select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>{EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}</select></Field>
    <Field label="Par" hint="ej: BTC/USDT"><input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} /></Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Spread (%)" hint="distancia bid/ask"><input className="form-input" type="number" step="0.1" min="0.1" max="10" value={cfg.spread_pct} onChange={e => set({ ...cfg, spread_pct: +e.target.value })} /></Field>
      <Field label="Tamaño por orden" hint="moneda base"><input className="form-input" type="number" step="any" min="0" value={cfg.order_size} onChange={e => set({ ...cfg, order_size: +e.target.value })} /></Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Niveles por lado" hint="1-5"><input className="form-input" type="number" min="1" max="5" value={cfg.levels} onChange={e => set({ ...cfg, levels: +e.target.value })} /></Field>
      <Field label="Intervalo (seg)"><input className="form-input" type="number" min="5" value={cfg.refresh_interval} onChange={e => set({ ...cfg, refresh_interval: +e.target.value })} /></Field>
    </div>
    <Field label="Inventario máximo" hint="moneda base acumulable"><input className="form-input" type="number" step="any" min="0" value={cfg.max_inventory} onChange={e => set({ ...cfg, max_inventory: +e.target.value })} /></Field>
  </>;
}

function ArbitrageForm({ cfg, set }) {
  return <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Exchange A">
        <select className="form-select" value={cfg.exchange_a} onChange={e => set({ ...cfg, exchange_a: e.target.value })}>
          {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
        </select>
      </Field>
      <Field label="Exchange B">
        <select className="form-select" value={cfg.exchange_b} onChange={e => set({ ...cfg, exchange_b: e.target.value })}>
          {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
        </select>
      </Field>
    </div>
    <Field label="Par" hint="debe existir en ambos exchanges">
      <input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} />
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Capital por operación" hint="moneda quote">
        <input className="form-input" type="number" step="any" min="1" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} />
      </Field>
      <Field label="Spread mínimo (%)" hint="umbral para ejecutar">
        <input className="form-input" type="number" step="0.05" min="0.05" value={cfg.min_spread_pct} onChange={e => set({ ...cfg, min_spread_pct: +e.target.value })} />
      </Field>
    </div>
    <Field label="Intervalo de escaneo (seg)">
      <input className="form-input" type="number" min="5" value={cfg.check_interval} onChange={e => set({ ...cfg, check_interval: +e.target.value })} />
    </Field>
    <div style={{ padding: '0.6rem 0.75rem', background: '#0f172a', borderRadius: 6,
      border: '1px solid #334155', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
      El bot compra en el exchange con precio más bajo y vende en el más alto cuando el spread supera el umbral.
    </div>
  </>;
}

const TYPE_INFO = {
  dca:           { label: 'Bot DCA',            color: '#38bdf8', desc: 'Compras periódicas automáticas a intervalos fijos.' },
  grid:          { label: 'Bot Grid Trading',   color: '#a78bfa', desc: 'Compra y vende en niveles de precio dentro de un rango.' },
  signal:        { label: 'Bot de Señales',     color: '#fb923c', desc: 'Opera automáticamente cuando RSI o MACD activan una condición.' },
  ia_dynamic:    { label: 'Bot IA Dinámico',    color: '#34d399', desc: 'Analiza las 30-50 criptos con más volumen cada hora y mantiene las mejores posiciones automáticamente.' },
  market_making: { label: 'Bot Market Making',  color: '#f59e0b', desc: 'Publica órdenes de compra/venta a ambos lados del precio para capturar el spread de forma continua.' },
  arbitrage:     { label: 'Bot Arbitraje',      color: '#e879f9', desc: 'Explota diferencias de precio del mismo activo entre dos exchanges en tiempo real.' },
  scalping:       { label: 'Bot Scalping',        color: '#f43f5e', desc: 'Abre y cierra posiciones rápidas con take-profit y stop-loss ajustados usando RSI y MACD en timeframes cortos.' },
  mean_reversion: { label: 'Bot Mean Reversion',  color: '#06b6d4', desc: 'Compra cuando el precio cae bajo la banda inferior de Bollinger y vende cuando regresa a la media.' },
  momentum:       { label: 'Bot Momentum',        color: '#84cc16', desc: 'Entra cuando RSI y MACD confirman momentum alcista. Sale con trailing stop dinámico cuando el impulso se agota.' },
  funding_arb:    { label: 'Funding Rate Arb',    color: '#f97316', desc: 'Delta neutral: long spot + short perpetuo. Cobra el funding rate cada 8 h sin exposición al precio. 5-20 %/año típico.' },
};

function MomentumForm({ cfg, set }) {
  return <>
    <Field label="Exchange">
      <select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>
        {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
      </select>
    </Field>
    <Field label="Par" hint="ej: BTC/USDT">
      <input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} />
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Cantidad" hint="moneda base">
        <input className="form-input" type="number" step="any" min="0" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} />
      </Field>
      <Field label="Timeframe">
        <select className="form-select" value={cfg.timeframe} onChange={e => set({ ...cfg, timeframe: e.target.value })}>
          {['15m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
        </select>
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI mínimo entrada" hint="momentum positivo">
        <input className="form-input" type="number" min="50" max="70" value={cfg.rsi_min} onChange={e => set({ ...cfg, rsi_min: +e.target.value })} />
      </Field>
      <Field label="RSI máximo entrada" hint="evitar sobrecompra">
        <input className="form-input" type="number" min="60" max="85" value={cfg.rsi_max} onChange={e => set({ ...cfg, rsi_max: +e.target.value })} />
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
      <Field label="Take Profit (%)">
        <input className="form-input" type="number" step="0.5" min="0.5" value={cfg.take_profit_pct} onChange={e => set({ ...cfg, take_profit_pct: +e.target.value })} />
      </Field>
      <Field label="Stop Loss (%)">
        <input className="form-input" type="number" step="0.5" min="0.5" value={cfg.stop_loss_pct} onChange={e => set({ ...cfg, stop_loss_pct: +e.target.value })} />
      </Field>
      <Field label="Trailing Stop (%)">
        <input className="form-input" type="number" step="0.25" min="0.25" value={cfg.trailing_stop_pct} onChange={e => set({ ...cfg, trailing_stop_pct: +e.target.value })} />
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Intervalo chequeo (min)">
        <input className="form-input" type="number" min="5" value={cfg.check_interval_minutes} onChange={e => set({ ...cfg, check_interval_minutes: +e.target.value })} />
      </Field>
      <Field label="Máx. horas en posición">
        <input className="form-input" type="number" min="1" value={cfg.max_open_hours} onChange={e => set({ ...cfg, max_open_hours: +e.target.value })} />
      </Field>
    </div>
    <div style={{ padding: '0.6rem 0.75rem', background: '#0f172a', borderRadius: 6,
      border: '1px solid #334155', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
      Entra cuando RSI está en zona {cfg.rsi_min}–{cfg.rsi_max}, MACD es alcista y el precio supera la media de Bollinger. El trailing stop protege ganancias dinámicamente.
    </div>
  </>;
}

function MeanReversionForm({ cfg, set }) {
  return <>
    <Field label="Exchange">
      <select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>
        {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
      </select>
    </Field>
    <Field label="Par" hint="ej: BTC/USDT">
      <input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} />
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Cantidad" hint="moneda base">
        <input className="form-input" type="number" step="any" min="0" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} />
      </Field>
      <Field label="Timeframe">
        <select className="form-select" value={cfg.timeframe} onChange={e => set({ ...cfg, timeframe: e.target.value })}>
          {['15m','1h','4h','1d'].map(tf => <option key={tf}>{tf}</option>)}
        </select>
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Stop Loss (%)" hint="desde precio de entrada">
        <input className="form-input" type="number" step="0.5" min="0.5" value={cfg.stop_loss_pct} onChange={e => set({ ...cfg, stop_loss_pct: +e.target.value })} />
      </Field>
      <Field label="Intervalo chequeo (min)">
        <input className="form-input" type="number" min="5" value={cfg.check_interval_minutes} onChange={e => set({ ...cfg, check_interval_minutes: +e.target.value })} />
      </Field>
    </div>
    <Field label="Tiempo máximo en posición (horas)">
      <input className="form-input" type="number" min="1" value={cfg.max_open_hours} onChange={e => set({ ...cfg, max_open_hours: +e.target.value })} />
    </Field>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!cfg.rsi_confirm} onChange={e => set({ ...cfg, rsi_confirm: e.target.checked })} />
        <span>Confirmar entrada con RSI</span>
      </label>
      {cfg.rsi_confirm && (
        <Field label="RSI máximo para entrar" hint="sobrevendido">
          <input className="form-input" type="number" min="10" max="50" value={cfg.rsi_oversold} onChange={e => set({ ...cfg, rsi_oversold: +e.target.value })} />
        </Field>
      )}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
        <input type="checkbox" style={{ marginTop: 3 }} checked={!!cfg.exit_at_mean} onChange={e => set({ ...cfg, exit_at_mean: e.target.checked })} />
        <div>
          <div style={{ fontWeight: 600 }}>{cfg.exit_at_mean ? 'Salir en la media (conservador)' : 'Salir en banda superior (agresivo)'}</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{cfg.exit_at_mean ? 'Cierra cuando el precio recupera la SMA(20)' : 'Cierra cuando el precio alcanza la banda superior'}</div>
        </div>
      </label>
    </div>
  </>;
}

function ScalpingForm({ cfg, set }) {
  return <>
    <Field label="Exchange">
      <select className="form-select" value={cfg.exchange} onChange={e => set({ ...cfg, exchange: e.target.value })}>
        {EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
      </select>
    </Field>
    <Field label="Par" hint="ej: BTC/USDT">
      <input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value })} />
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Cantidad" hint="moneda base">
        <input className="form-input" type="number" step="any" min="0" value={cfg.amount} onChange={e => set({ ...cfg, amount: +e.target.value })} />
      </Field>
      <Field label="Timeframe">
        <select className="form-select" value={cfg.timeframe} onChange={e => set({ ...cfg, timeframe: e.target.value })}>
          {['1m','3m','5m','15m'].map(tf => <option key={tf}>{tf}</option>)}
        </select>
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Take Profit (%)" hint="ganancia para cerrar">
        <input className="form-input" type="number" step="0.1" min="0.1" value={cfg.take_profit_pct} onChange={e => set({ ...cfg, take_profit_pct: +e.target.value })} />
      </Field>
      <Field label="Stop Loss (%)" hint="pérdida máxima">
        <input className="form-input" type="number" step="0.05" min="0.05" value={cfg.stop_loss_pct} onChange={e => set({ ...cfg, stop_loss_pct: +e.target.value })} />
      </Field>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="RSI entrada" hint="RSI máx. para comprar">
        <input className="form-input" type="number" min="20" max="60" value={cfg.rsi_entry} onChange={e => set({ ...cfg, rsi_entry: +e.target.value })} />
      </Field>
      <Field label="Intervalo (seg)">
        <input className="form-input" type="number" min="10" value={cfg.check_interval} onChange={e => set({ ...cfg, check_interval: +e.target.value })} />
      </Field>
    </div>
    <Field label="Tiempo máximo en posición (min)" hint="cierre forzado por tiempo">
      <input className="form-input" type="number" min="5" value={cfg.max_open_minutes} onChange={e => set({ ...cfg, max_open_minutes: +e.target.value })} />
    </Field>
    <div style={{ padding: '0.6rem 0.75rem', background: '#0f172a', borderRadius: 6,
      border: '1px solid #334155', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
      Entra cuando RSI &lt; umbral y MACD es alcista. Sale por TP, SL, cambio de señal o tiempo máximo.
    </div>
  </>;
}

const FUNDING_SYMBOL_HINTS = {
  binance: 'ej: BTCUSDT, ETHUSDT',
  gateio:  'ej: BTC_USDT, ETH_USDT',
  bybit:   'ej: BTCUSDT, ETHUSDT',
  okx:     'ej: BTCUSDT, ETHUSDT (se convierte a BTC-USDT-SWAP)',
};
const FUNDING_DEFAULT_SYMBOL = {
  binance: 'BTCUSDT', gateio: 'BTC_USDT', bybit: 'BTCUSDT', okx: 'BTCUSDT',
};

function FundingArbForm({ cfg, set }) {
  const PERP_EXCHANGES = ['binance', 'bybit', 'okx', 'gateio'];
  return <>
    <Field label="Exchange" hint="debe tener perpetuos">
      <select className="form-select" value={cfg.exchange} onChange={e => {
        const ex = e.target.value;
        set({ ...cfg, exchange: ex, symbol: FUNDING_DEFAULT_SYMBOL[ex] || 'BTCUSDT' });
      }}>
        {PERP_EXCHANGES.map(ex => <option key={ex}>{ex}</option>)}
      </select>
    </Field>
    <Field label="Símbolo perpetuo" hint={FUNDING_SYMBOL_HINTS[cfg.exchange] || 'ej: BTCUSDT'}>
      <input className="form-input" value={cfg.symbol} onChange={e => set({ ...cfg, symbol: e.target.value.toUpperCase() })} />
    </Field>
    <Field label="Capital (USDT)" hint="se divide entre spot y margen">
      <input className="form-input" type="number" min="10" step="10" value={cfg.amount_usdt}
        onChange={e => set({ ...cfg, amount_usdt: +e.target.value })} />
    </Field>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      <Field label="Funding mínimo %" hint="por cada 8 h">
        <input className="form-input" type="number" step="0.001" min="0.001" value={cfg.min_funding_rate_pct}
          onChange={e => set({ ...cfg, min_funding_rate_pct: +e.target.value })} />
      </Field>
      <Field label="Intervalo chequeo (min)">
        <input className="form-input" type="number" min="5" value={cfg.check_interval_minutes}
          onChange={e => set({ ...cfg, check_interval_minutes: +e.target.value })} />
      </Field>
    </div>
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={cfg.auto_exit_on_negative}
        onChange={e => set({ ...cfg, auto_exit_on_negative: e.target.checked })} />
      Cerrar posición si el funding se vuelve negativo
    </label>
    <div style={{ padding: '0.6rem 0.75rem', background: '#14532d22', borderRadius: 6,
      border: '1px solid #4ade8033', fontSize: '0.75rem', color: '#86efac', marginTop: '0.25rem' }}>
      Abre long en spot + short en perpetuo (delta neutral). Gana el funding rate cada 8 h sin exposición al precio.
      Rendimiento típico: <strong>5–20 % anual</strong> en mercados alcistas.
    </div>
  </>;
}

export default function CreateBotModal({ onClose, onCreated }) {
  const [step, setStep]       = useState(1);
  const [type, setType]       = useState('dca');
  const [name, setName]       = useState('');
  const [sandbox, setSandbox] = useState(true);
  const [cfg, setCfg]         = useState(DEFAULTS.dca);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const selectType = (t) => { setType(t); setCfg(DEFAULTS[t]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const bot = await botsApi.create({ type, name: name || undefined, config: cfg, sandbox });
      onCreated(bot);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Crear Bot</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Paso 1: elegir tipo */}
        {step === 1 && (
          <div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>Elige el tipo de bot:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {Object.entries(TYPE_INFO).map(([t, info]) => (
                <div key={t} onClick={() => selectType(t)}
                  style={{ padding: '0.875rem 1rem', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${type === t ? info.color : '#334155'}`,
                    background: type === t ? info.color + '11' : '#0f172a' }}>
                  <div style={{ fontWeight: 700, color: type === t ? info.color : '#e2e8f0', marginBottom: 2 }}>{info.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{info.desc}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(2)}>
              Continuar →
            </button>
          </div>
        )}

        {/* Paso 2: configurar */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del bot (opcional)</label>
                <input className="form-input" placeholder={`${TYPE_INFO[type].label} #1`} value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>

            {type === 'dca'           && <DCAForm          cfg={cfg} set={setCfg} />}
            {type === 'grid'          && <GridForm         cfg={cfg} set={setCfg} />}
            {type === 'signal'        && <SignalForm        cfg={cfg} set={setCfg} />}
            {type === 'ia_dynamic'    && <IADynamicForm     cfg={cfg} set={setCfg} />}
            {type === 'market_making' && <MarketMakingForm  cfg={cfg} set={setCfg} />}
            {type === 'arbitrage'     && <ArbitrageForm     cfg={cfg} set={setCfg} />}
            {type === 'scalping'        && <ScalpingForm       cfg={cfg} set={setCfg} />}
            {type === 'mean_reversion'  && <MeanReversionForm  cfg={cfg} set={setCfg} />}
            {type === 'momentum'        && <MomentumForm       cfg={cfg} set={setCfg} />}
            {type === 'funding_arb'    && <FundingArbForm     cfg={cfg} set={setCfg} />}

            <div style={{ margin: '1rem 0', padding: '0.75rem 1rem',
              background: sandbox ? '#0c4a6e22' : '#45090922',
              border: `1px solid ${sandbox ? '#0284c744' : '#f8717144'}`,
              borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {sandbox ? '🧪 Modo Sandbox' : '⚡ Modo Real'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {sandbox ? 'Las órdenes son simuladas, sin dinero real.' : 'Las órdenes se ejecutan en el exchange real.'}
                  </div>
                </div>
              </label>
            </div>

            {error && <p className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }} onClick={() => setStep(1)}>← Atrás</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Bot'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
