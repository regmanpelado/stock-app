import React, { useState, useEffect, useCallback } from "react";
import { marketApi } from "../services/api.jsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const EXCHANGES = ["NYSE","NASDAQ","BME","LSE","EURONEXT","XETRA","TSE","HKEX"];
const EXCHANGE_LABELS = { NYSE:"NYSE", NASDAQ:"NASDAQ", BME:"IBEX/BME", LSE:"Londres", EURONEXT:"Euronext", XETRA:"Xetra/DAX", TSE:"Tokio", HKEX:"Hong Kong" };

function IndicesBar({ indices }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
      {indices.map(idx => {
        const pos = idx.change_pct >= 0;
        return (
          <div key={idx.ticker} className="card" style={{ padding: "0.7rem 1rem", minWidth: 140, flexShrink: 0 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--td)", fontWeight: 600 }}>{idx.region}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ts)", margin: "2px 0" }}>{idx.name}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--tx)" }}>
              {idx.price?.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171" }}>
              {pos ? "+" : ""}{idx.change_pct?.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CurrenciesBar({ currencies }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
      {currencies.map(c => {
        const pos = c.change_pct >= 0;
        return (
          <div key={c.ticker} className="card" style={{ padding: "0.5rem 0.85rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ts)" }}>{c.name}</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--tx)" }}>{c.price?.toFixed(4)}</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171" }}>
              {pos ? "+" : ""}{c.change_pct?.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectorTable({ sectors }) {
  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <h3 style={{ fontSize: "0.85rem", color: "var(--td)", fontWeight: 600, marginBottom: "0.75rem" }}>SECTORES S&P500</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: "0.5rem" }}>
        {sectors.map(s => {
          const pos = s.change_pct >= 0;
          const w = Math.min(Math.abs(s.change_pct) * 15, 100);
          return (
            <div key={s.sector} style={{ padding: "0.5rem 0.75rem", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--bd)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: "0.78rem", color: "var(--ts)", fontWeight: 600 }}>{s.sector}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171" }}>
                  {pos ? "+" : ""}{s.change_pct?.toFixed(2)}%
                </span>
              </div>
              <div style={{ height: 4, background: "var(--bd)", borderRadius: 2 }}>
                <div style={{ width: `${w}%`, height: "100%", background: pos ? "#4ade80" : "#f87171", borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockChart({ history }) {
  if (!history?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={history}>
        <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(0,10)} interval="preserveStartEnd" />
        <YAxis domain={["auto","auto"]} tick={{ fontSize: 10 }} width={60} />
        <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, "Precio"]} labelFormatter={v => v?.slice(0,10)} />
        <Line type="monotone" dataKey="close" stroke="#38bdf8" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Markets() {
  const [indices,    setIndices]    = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [sectors,    setSectors]    = useState([]);
  const [popular,    setPopular]    = useState([]);
  const [exchange,   setExchange]   = useState("NYSE");
  const [searchQ,    setSearchQ]    = useState("");
  const [searchRes,  setSearchRes]  = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [history,    setHistory]    = useState([]);
  const [quote,      setQuote]      = useState(null);
  const [period,     setPeriod]     = useState("6mo");
  const [loadingPop, setLoadingPop] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingChart,  setLoadingChart]  = useState(false);

  useEffect(() => {
    marketApi.getIndices().then(setIndices).catch(() => {});
    marketApi.getCurrencies().then(setCurrencies).catch(() => {});
    marketApi.getSectors().then(setSectors).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingPop(true);
    marketApi.getPopular(exchange).then(d => { setPopular(d); setLoadingPop(false); }).catch(() => setLoadingPop(false));
  }, [exchange]);

  const loadStock = useCallback(async (symbol, exch) => {
    setSelected({ symbol, exchange: exch });
    setLoadingChart(true);
    try {
      const [q, h] = await Promise.all([
        marketApi.getQuote(symbol, exch).catch(() => null),
        marketApi.getHistory(symbol, exch, period).catch(() => []),
      ]);
      setQuote(q);
      setHistory(h);
    } finally {
      setLoadingChart(false);
    }
  }, [period]);

  useEffect(() => {
    if (selected) loadStock(selected.symbol, selected.exchange);
  }, [period]);

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setLoadingSearch(true);
    try {
      const r = await marketApi.search(searchQ.trim());
      setSearchRes(r);
    } catch { setSearchRes([]); }
    setLoadingSearch(false);
  };

  const pos = quote && quote.change_pct >= 0;

  return (
    <div>
      <h1 className="page-title">Mercados</h1>

      {indices.length > 0 && <IndicesBar indices={indices} />}
      {currencies.length > 0 && <CurrenciesBar currencies={currencies} />}

      {/* Buscador */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: searchRes ? "0.75rem" : 0 }}>
          <input className="form-input" placeholder="Buscar accion... (ej: AAPL, SAN.MC, VOD.L)"
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={doSearch} disabled={loadingSearch}>
            {loadingSearch ? "..." : "Buscar"}
          </button>
        </div>
        {searchRes && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {searchRes.length === 0
              ? <div style={{ color: "var(--td)", fontSize: "0.85rem" }}>Sin resultados</div>
              : searchRes.map(r => (
                <button key={r.symbol} onClick={() => loadStock(r.symbol, r.exchange)}
                  style={{ padding: "0.3rem 0.75rem", borderRadius: 20, background: "#0c4a6e33",
                    border: "1px solid #0284c744", color: "#38bdf8", cursor: "pointer", fontSize: "0.82rem" }}>
                  {r.symbol} — {r.exchange}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Detalle de accion seleccionada */}
      {selected && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#38bdf8" }}>{selected.symbol}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--td)", marginLeft: "0.5rem" }}>{selected.exchange}</span>
              {quote && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--tx)" }}>${quote.price?.toFixed(2)}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171", marginLeft: "0.5rem" }}>
                    {pos ? "+" : ""}{quote.change_pct?.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--td)", marginLeft: "0.5rem" }}>{quote.currency}</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {["1mo","3mo","6mo","1y","5y"].map(p => (
                <button key={p} className="btn" onClick={() => setPeriod(p)}
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem",
                    background: period === p ? "#0284c7" : "var(--su)",
                    color: period === p ? "#fff" : "var(--td)", border: "1px solid var(--bd)" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {loadingChart
            ? <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--td)" }}>Cargando grafico...</div>
            : <StockChart history={history} />}
        </div>
      )}

      {/* Popular por bolsa */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {EXCHANGES.map(ex => (
            <button key={ex} className="btn" onClick={() => setExchange(ex)}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem",
                background: exchange === ex ? "#0284c7" : "var(--su)",
                color: exchange === ex ? "#fff" : "var(--ts)", border: "1px solid var(--bd)" }}>
              {EXCHANGE_LABELS[ex]}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <h3 style={{ fontSize: "0.82rem", color: "var(--td)", fontWeight: 600, marginBottom: "0.75rem" }}>
            ACCIONES POPULARES — {EXCHANGE_LABELS[exchange]}
          </h3>
          {loadingPop
            ? <p style={{ color: "var(--td)", fontSize: "0.85rem" }}>Cargando...</p>
            : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: "0.5rem" }}>
                {popular.map(s => {
                  const pos = s.change_pct >= 0;
                  return (
                    <div key={s.symbol} onClick={() => loadStock(s.symbol, exchange)}
                      className="card" style={{ padding: "0.6rem 0.75rem", cursor: "pointer", border: selected?.symbol === s.symbol ? "1px solid #0284c7" : "1px solid var(--bd)" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#38bdf8", marginBottom: 2 }}>{s.symbol}</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--tx)" }}>
                        {s.price > 0 ? `$${s.price.toFixed(2)}` : "--"}
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171" }}>
                        {pos ? "+" : ""}{s.change_pct?.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {sectors.length > 0 && <SectorTable sectors={sectors} />}
    </div>
  );
}
