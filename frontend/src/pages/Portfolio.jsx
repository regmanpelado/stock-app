import React, { useState, useEffect } from "react";
import { portfolioApi, marketApi } from "../services/api.jsx";

const EXCHANGES = ["NYSE","NASDAQ","BME","LSE","EURONEXT","XETRA","TSE","HKEX"];

function AddPositionModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ symbol:"", exchange:"NYSE", shares:"", avg_price:"", currency:"USD", notes:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    if (!form.symbol || !form.shares || !form.avg_price) { setError("Rellena simbolo, acciones y precio"); return; }
    setLoading(true); setError("");
    try {
      const pos = await portfolioApi.addPosition({
        symbol: form.symbol.toUpperCase(),
        exchange: form.exchange,
        shares: parseFloat(form.shares),
        avg_price: parseFloat(form.avg_price),
        currency: form.currency,
        notes: form.notes,
      });
      onAdded(pos);
      onClose();
    } catch (e) { setError(e.response?.data?.detail || "Error al guardar"); }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="card" style={{ width:"100%", maxWidth:420, padding:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"1.25rem" }}>
          <h2 style={{ fontSize:"1rem", fontWeight:700 }}>Anadir posicion</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--td)", cursor:"pointer", fontSize:"1.2rem" }}>x</button>
        </div>
        {error && <div style={{ background:"#450a0a22", color:"#f87171", padding:"0.6rem", borderRadius:6, marginBottom:"0.75rem", fontSize:"0.82rem" }}>{error}</div>}
        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Simbolo *</div>
              <input className="form-input" placeholder="AAPL" value={form.symbol} onChange={e => set("symbol", e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Bolsa</div>
              <select className="form-input" value={form.exchange} onChange={e => set("exchange", e.target.value)}>
                {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>N acciones *</div>
              <input className="form-input" type="number" step="any" placeholder="10" value={form.shares} onChange={e => set("shares", e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Precio medio compra *</div>
              <input className="form-input" type="number" step="any" placeholder="150.00" value={form.avg_price} onChange={e => set("avg_price", e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Moneda</div>
              <select className="form-input" value={form.currency} onChange={e => set("currency", e.target.value)}>
                {["USD","EUR","GBP","JPY","HKD"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Notas</div>
              <input className="form-input" placeholder="Opcional" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Guardando..." : "Anadir posicion"}</button>
        </form>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const [data,     setData]    = useState(null);
  const [alpaca,   setAlpaca]  = useState(null);
  const [loading,  setLoading] = useState(true);
  const [showAdd,  setShowAdd] = useState(false);
  const [tab,      setTab]     = useState("manual");

  const load = () => {
    setLoading(true);
    Promise.all([
      portfolioApi.get().catch(() => null),
      portfolioApi.getAlpaca().catch(() => null),
    ]).then(([d, a]) => { setData(d); setAlpaca(a); setLoading(false); });
  };

  useEffect(load, []);

  const deletePos = async (id) => {
    if (!confirm("Eliminar esta posicion?")) return;
    await portfolioApi.deletePosition(id).catch(() => {});
    load();
  };

  const summary = data?.summary;
  const positions = data?.positions || [];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <h1 className="page-title" style={{ margin:0 }}>Portfolio</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Anadir posicion</button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
        {["manual","alpaca"].map(t => (
          <button key={t} className="btn" onClick={() => setTab(t)}
            style={{ background: tab===t ? "#0284c7":"var(--su)", color: tab===t?"#fff":"var(--ts)", border:"1px solid var(--bd)", fontSize:"0.85rem", textTransform:"capitalize" }}>
            {t === "manual" ? "Manual" : "Alpaca"}
          </button>
        ))}
      </div>

      {loading ? <p className="loading">Cargando portfolio...</p> : (
        <>
          {tab === "manual" && (
            <>
              {/* Resumen */}
              {summary && summary.count > 0 && (
                <div className="grid-4" style={{ marginBottom:"1.5rem" }}>
                  {[
                    { label:"Valor total",  value:`$${summary.total_value?.toFixed(2)}`,           color:"var(--ts)" },
                    { label:"Invertido",    value:`$${summary.total_invested?.toFixed(2)}`,         color:"var(--td)" },
                    { label:"P&L total",    value:`${summary.total_pnl>=0?"+":""}$${summary.total_pnl?.toFixed(2)}`, color: summary.total_pnl>=0?"#4ade80":"#f87171" },
                    { label:"Rentabilidad", value:`${summary.total_pnl_pct>=0?"+":""}${summary.total_pnl_pct?.toFixed(2)}%`, color: summary.total_pnl_pct>=0?"#4ade80":"#f87171" },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"1.3rem", fontWeight:800, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:"0.73rem", color:"var(--td)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {positions.length === 0 ? (
                <div className="card" style={{ textAlign:"center", padding:"3rem 2rem" }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>📈</div>
                  <div style={{ color:"var(--td)", marginBottom:"1.25rem" }}>No tienes posiciones todavia.</div>
                  <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Anadir mi primera posicion</button>
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.85rem" }}>
                    <thead>
                      <tr style={{ color:"var(--td)", fontSize:"0.73rem" }}>
                        {["Simbolo","Bolsa","Acciones","Precio compra","Precio actual","Valor","P&L",""].map(h => (
                          <th key={h} style={{ textAlign:"left", padding:"0.4rem 0.6rem", fontWeight:600, background:"var(--su)", borderBottom:"1px solid var(--bd)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(p => (
                        <tr key={p.id} style={{ borderBottom:"1px solid var(--bd)" }}>
                          <td style={{ padding:"0.55rem 0.6rem", fontWeight:700, color:"#38bdf8" }}>{p.symbol}</td>
                          <td style={{ padding:"0.55rem 0.6rem", color:"var(--td)" }}>{p.exchange}</td>
                          <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)" }}>{p.shares}</td>
                          <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)" }}>${p.avg_price?.toFixed(2)}</td>
                          <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)" }}>${p.current_price?.toFixed(2)}</td>
                          <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)", fontWeight:600 }}>${p.value?.toFixed(2)}</td>
                          <td style={{ padding:"0.55rem 0.6rem", fontWeight:700, color: p.pnl>=0?"#4ade80":"#f87171" }}>
                            {p.pnl>=0?"+":""}${p.pnl?.toFixed(2)} <span style={{ fontSize:"0.75rem" }}>({p.pnl_pct?.toFixed(1)}%)</span>
                          </td>
                          <td style={{ padding:"0.55rem 0.6rem" }}>
                            <button onClick={() => deletePos(p.id)}
                              style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:"0.9rem" }}>
                              x
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "alpaca" && (
            <div>
              {!alpaca || alpaca.error ? (
                <div className="card" style={{ padding:"1.5rem" }}>
                  <div style={{ color:"var(--td)", fontSize:"0.9rem", marginBottom:"0.5rem" }}>
                    Alpaca no esta configurado. Anade tus claves ALPACA_API_KEY y ALPACA_SECRET_KEY en Railway.
                  </div>
                  {alpaca?.error && <div style={{ color:"#f87171", fontSize:"0.82rem" }}>{alpaca.error}</div>}
                </div>
              ) : (
                <>
                  <div className="grid-4" style={{ marginBottom:"1.25rem" }}>
                    {[
                      { label:"Valor portfolio", value:`$${alpaca.summary?.total_value?.toFixed(2)||"--"}`, color:"var(--ts)" },
                      { label:"Cash",            value:`$${alpaca.account?.cash?.toFixed(2)||"--"}`,        color:"var(--td)" },
                      { label:"Poder compra",    value:`$${alpaca.account?.buying_power?.toFixed(2)||"--"}`,color:"#38bdf8" },
                      { label:"P&L no realizado",value:`$${alpaca.summary?.total_pnl?.toFixed(2)||"--"}`,  color: (alpaca.summary?.total_pnl||0)>=0?"#4ade80":"#f87171" },
                    ].map(s => (
                      <div key={s.label} className="card" style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"1.1rem", fontWeight:800, color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:"0.73rem", color:"var(--td)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap: "0.5rem", alignItems:"center", marginBottom:"0.75rem" }}>
                    <span style={{ fontSize:"0.75rem", padding:"0.2rem 0.6rem", borderRadius:20,
                      background: alpaca.paper ? "#0c4a6e33":"#052e1633",
                      border: alpaca.paper ? "1px solid #0284c744":"1px solid #16a34a44",
                      color: alpaca.paper ? "#38bdf8":"#4ade80", fontWeight:700 }}>
                      {alpaca.paper ? "PAPER TRADING" : "REAL TRADING"}
                    </span>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.85rem" }}>
                      <thead>
                        <tr style={{ color:"var(--td)", fontSize:"0.73rem" }}>
                          {["Simbolo","Acciones","Precio medio","Valor mercado","P&L","P&L %"].map(h => (
                            <th key={h} style={{ textAlign:"left", padding:"0.4rem 0.6rem", fontWeight:600, background:"var(--su)", borderBottom:"1px solid var(--bd)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(alpaca.positions||[]).map(p => (
                          <tr key={p.symbol} style={{ borderBottom:"1px solid var(--bd)" }}>
                            <td style={{ padding:"0.55rem 0.6rem", fontWeight:700, color:"#38bdf8" }}>{p.symbol}</td>
                            <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)" }}>{p.qty}</td>
                            <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)" }}>${p.avg_entry?.toFixed(2)}</td>
                            <td style={{ padding:"0.55rem 0.6rem", color:"var(--ts)", fontWeight:600 }}>${p.market_value?.toFixed(2)}</td>
                            <td style={{ padding:"0.55rem 0.6rem", fontWeight:700, color: p.unrealized_pnl>=0?"#4ade80":"#f87171" }}>
                              {p.unrealized_pnl>=0?"+":""}${p.unrealized_pnl?.toFixed(2)}
                            </td>
                            <td style={{ padding:"0.55rem 0.6rem", fontWeight:700, color: p.unrealized_pnl_pct>=0?"#4ade80":"#f87171" }}>
                              {p.unrealized_pnl_pct>=0?"+":""}${p.unrealized_pnl_pct?.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(alpaca.positions||[]).length === 0 && (
                      <div style={{ padding:"2rem", textAlign:"center", color:"var(--td)" }}>Sin posiciones en Alpaca</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showAdd && <AddPositionModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
