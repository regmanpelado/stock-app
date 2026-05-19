import React, { useState, useEffect } from "react";
import { signalsApi } from "../services/api.jsx";

const EXCHANGES = ["NYSE","NASDAQ","BME","LSE","EURONEXT","XETRA","TSE","HKEX"];
const EX_LABELS  = { NYSE:"NYSE", NASDAQ:"NASDAQ", BME:"Madrid", LSE:"Londres", EURONEXT:"Paris", XETRA:"Frankfurt", TSE:"Tokio", HKEX:"HK" };

function SignalBadge({ signal }) {
  const colors = { BUY:"#4ade80", SELL:"#f87171", NEUTRAL:"#94a3b8" };
  return (
    <span style={{ padding:"0.2rem 0.6rem", borderRadius:20, fontSize:"0.72rem", fontWeight:700,
      background: colors[signal]+"22", color: colors[signal], border:`1px solid ${colors[signal]}44` }}>
      {signal}
    </span>
  );
}

function RsiBar({ rsi }) {
  const color = rsi < 35 ? "#4ade80" : rsi > 65 ? "#f87171" : "#94a3b8";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
      <div style={{ width:60, height:6, background:"var(--bd)", borderRadius:3 }}>
        <div style={{ width:`${rsi}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <span style={{ fontSize:"0.78rem", color, fontWeight:600 }}>{rsi?.toFixed(0)}</span>
    </div>
  );
}

export default function Signals() {
  const [exchange,  setExchange]  = useState("NYSE");
  const [screener,  setScreener]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [symbol,    setSymbol]    = useState("");
  const [detail,    setDetail]    = useState(null);
  const [loadingDet,setLoadingDet]= useState(false);

  const loadScreener = (ex) => {
    setExchange(ex); setLoading(true);
    signalsApi.getScreener(ex, 10)
      .then(setScreener).catch(() => setScreener([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadScreener("NYSE"); }, []);

  const loadDetail = () => {
    if (!symbol.trim()) return;
    setLoadingDet(true); setDetail(null);
    signalsApi.getSymbol(exchange, symbol.toUpperCase())
      .then(setDetail).catch(() => setDetail({ error:"No se encontraron datos" }))
      .finally(() => setLoadingDet(false));
  };

  return (
    <div>
      <h1 className="page-title">Senales Tecnicas</h1>

      {/* Tabs bolsas */}
      <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"1.25rem" }}>
        {EXCHANGES.map(ex => (
          <button key={ex} className="btn" onClick={() => loadScreener(ex)}
            style={{ fontSize:"0.78rem", padding:"0.25rem 0.65rem",
              background: exchange===ex ? "#0284c7":"var(--su)",
              color: exchange===ex ? "#fff":"var(--ts)", border:"1px solid var(--bd)" }}>
            {EX_LABELS[ex]}
          </button>
        ))}
      </div>

      {/* Buscar simbolo concreto */}
      <div className="card" style={{ padding:"0.85rem 1rem", marginBottom:"1.25rem", display:"flex", gap:"0.5rem" }}>
        <input className="form-input" placeholder="Analizar simbolo... (ej: AAPL)"
          value={symbol} onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key==="Enter" && loadDetail()} style={{ flex:1 }} />
        <button className="btn btn-primary" onClick={loadDetail} disabled={loadingDet || !symbol.trim()}>
          {loadingDet ? "..." : "Analizar"}
        </button>
      </div>

      {/* Detalle de un simbolo */}
      {detail && (
        <div className="card" style={{ padding:"1.25rem", marginBottom:"1.25rem" }}>
          {detail.error ? (
            <div style={{ color:"#f87171" }}>{detail.error}</div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", flexWrap:"wrap", gap:"0.5rem" }}>
                <div>
                  <span style={{ fontSize:"1.2rem", fontWeight:800, color:"#38bdf8" }}>{detail.symbol}</span>
                  <span style={{ marginLeft:"0.75rem" }}><SignalBadge signal={detail.signal} /></span>
                </div>
                <div style={{ fontSize:"1.1rem", fontWeight:700, color:"var(--tx)" }}>
                  ${detail.price?.toFixed(2)}
                  <span style={{ fontSize:"0.85rem", marginLeft:"0.5rem", color: detail.change_pct>=0?"#4ade80":"#f87171" }}>
                    {detail.change_pct>=0?"+":""}{detail.change_pct?.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))", gap:"0.75rem" }}>
                {[
                  { label:"RSI (14)", value:<RsiBar rsi={detail.rsi} /> },
                  { label:"MACD", value:<span style={{ color: detail.macd?.histogram>0?"#4ade80":"#f87171", fontWeight:700 }}>{detail.macd?.histogram?.toFixed(4)}</span> },
                  { label:"SMA 20", value:<span style={{ color: detail.above_sma20?"#4ade80":"#f87171" }}>${detail.sma20?.toFixed(2)}</span> },
                  { label:"SMA 50", value:<span style={{ color: detail.above_sma50?"#4ade80":"#f87171" }}>${detail.sma50?.toFixed(2)}</span> },
                  { label:"SMA 200", value:<span style={{ color: detail.above_sma200?"#4ade80":"#f87171" }}>${detail.sma200?.toFixed(2)}</span> },
                ].map(item => (
                  <div key={item.label} style={{ background:"var(--bg)", borderRadius:6, padding:"0.6rem 0.75rem", border:"1px solid var(--bd)" }}>
                    <div style={{ fontSize:"0.7rem", color:"var(--td)", marginBottom:4, fontWeight:600 }}>{item.label}</div>
                    <div>{item.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Screener */}
      <div className="card" style={{ padding:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
          <h3 style={{ fontSize:"0.85rem", color:"var(--td)", fontWeight:600 }}>
            SCREENER — {EX_LABELS[exchange]}
          </h3>
          <button className="btn" style={{ fontSize:"0.78rem" }} onClick={() => loadScreener(exchange)}>Actualizar</button>
        </div>
        {loading ? (
          <p style={{ color:"var(--td)", fontSize:"0.85rem" }}>Calculando senales... (puede tardar unos segundos)</p>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.84rem" }}>
              <thead>
                <tr style={{ color:"var(--td)", fontSize:"0.72rem" }}>
                  {["Simbolo","Precio","Cambio","Senal","RSI","MACD","SMA20","SMA50"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"0.4rem 0.6rem", fontWeight:600, background:"var(--su)", borderBottom:"1px solid var(--bd)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screener.map(row => (
                  <tr key={row.symbol} style={{ borderBottom:"1px solid var(--bd)", cursor:"pointer" }}
                    onClick={() => { setSymbol(row.symbol); setDetail(row); }}>
                    <td style={{ padding:"0.5rem 0.6rem", fontWeight:700, color:"#38bdf8" }}>{row.symbol}</td>
                    <td style={{ padding:"0.5rem 0.6rem", color:"var(--ts)" }}>${row.price?.toFixed(2)}</td>
                    <td style={{ padding:"0.5rem 0.6rem", fontWeight:700, color: row.change_pct>=0?"#4ade80":"#f87171" }}>
                      {row.change_pct>=0?"+":""}{row.change_pct?.toFixed(2)}%
                    </td>
                    <td style={{ padding:"0.5rem 0.6rem" }}><SignalBadge signal={row.signal} /></td>
                    <td style={{ padding:"0.5rem 0.6rem" }}><RsiBar rsi={row.rsi} /></td>
                    <td style={{ padding:"0.5rem 0.6rem", color: row.macd?.histogram>0?"#4ade80":"#f87171", fontWeight:600 }}>
                      {row.macd?.histogram?.toFixed(4)}
                    </td>
                    <td style={{ padding:"0.5rem 0.6rem", color: row.above_sma20?"#4ade80":"#f87171" }}>${row.sma20?.toFixed(2)}</td>
                    <td style={{ padding:"0.5rem 0.6rem", color: row.above_sma50?"#4ade80":"#f87171" }}>${row.sma50?.toFixed(2)}</td>
                  </tr>
                ))}
                {screener.length === 0 && (
                  <tr><td colSpan={8} style={{ padding:"2rem", textAlign:"center", color:"var(--td)" }}>Sin datos disponibles</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
