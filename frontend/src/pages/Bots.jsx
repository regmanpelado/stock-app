import React, { useState, useEffect, useCallback } from "react";
import { botsApi } from "../services/api.jsx";

const TYPE_LABEL = { dca_stock:"DCA Acciones", momentum_stock:"Momentum", signal_stock:"Senales RSI/MACD", rebalance:"Rebalanceo" };
const TYPE_COLOR = { dca_stock:"#38bdf8", momentum_stock:"#84cc16", signal_stock:"#fb923c", rebalance:"#a78bfa" };
const TYPE_DESC  = {
  dca_stock: "Compra una accion periodicamente con importe fijo para promediar el precio.",
  momentum_stock: "Compra cuando el RSI muestra fuerza alcista y vende con trailing stop.",
  signal_stock: "Opera segun senales RSI y MACD: compra en sobreventa, vende en sobrecompra.",
  rebalance: "Mantiene proporciones fijas en una cartera y rebalancea automaticamente.",
};

const EXCHANGES = ["NYSE","NASDAQ","BME","LSE","EURONEXT","XETRA","TSE","HKEX"];

function StatusBadge({ status }) {
  const map = { running:["#4ade80","Activo"], paused:["#f59e0b","Pausado"], stopped:["#94a3b8","Detenido"], error:["#f87171","Error"] };
  const [color, label] = map[status] || ["#94a3b8","--"];
  return <span style={{ padding:"0.2rem 0.6rem", borderRadius:20, fontSize:"0.72rem", fontWeight:700, background:color+"22", color, border:`1px solid ${color}44` }}>{label}</span>;
}

function BotCard({ bot, onRefresh }) {
  const color = TYPE_COLOR[bot.type] || "#38bdf8";
  const cfg   = bot.config || {};
  const [loading, setLoading] = useState(false);

  const action = async (fn) => { setLoading(true); try { await fn(); await onRefresh(); } catch(e){} finally { setLoading(false); }};

  return (
    <div className="card" style={{ borderTop:`3px solid ${color}`, padding:"1.1rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.75rem" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:3 }}>{bot.name}</div>
          <div style={{ fontSize:"0.72rem", color, fontWeight:600 }}>{TYPE_LABEL[bot.type]}</div>
        </div>
        <StatusBadge status={bot.status} />
      </div>

      <div style={{ fontSize:"0.8rem", color:"var(--td)", marginBottom:"0.75rem" }}>
        {cfg.symbol && <span style={{ marginRight:"0.5rem", color:"var(--ts)", fontWeight:600 }}>{cfg.symbol}</span>}
        {cfg.exchange && <span style={{ marginRight:"0.5rem" }}>{cfg.exchange}</span>}
        {bot.sandbox && <span style={{ padding:"0.1rem 0.4rem", borderRadius:10, background:"#0c4a6e33", color:"#38bdf8", fontSize:"0.7rem" }}>SANDBOX</span>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.4rem", marginBottom:"0.85rem" }}>
        {[
          { label:"P&L", value:`${bot.pnl>=0?"+":""}$${(bot.pnl||0).toFixed(2)}`, color: bot.pnl>=0?"#4ade80":"#f87171" },
          { label:"Invertido", value:`$${(bot.total_invested||0).toFixed(2)}`, color:"var(--ts)" },
        ].map(s => (
          <div key={s.label} style={{ background:"var(--bg)", borderRadius:6, padding:"0.4rem 0.6rem", textAlign:"center" }}>
            <div style={{ fontSize:"0.85rem", fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:"0.65rem", color:"var(--td)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {bot.error && <div style={{ fontSize:"0.75rem", color:"#f87171", marginBottom:"0.5rem", padding:"0.4rem", background:"#450a0a22", borderRadius:4 }}>{bot.error}</div>}

      <div style={{ display:"flex", gap:"0.4rem" }}>
        {bot.status !== "running"  && <button className="btn" style={{ flex:1, fontSize:"0.78rem", background:"#052e1633", color:"#4ade80", border:"1px solid #16a34a44" }} disabled={loading} onClick={() => action(() => botsApi.start(bot.id))}>Iniciar</button>}
        {bot.status === "running"  && <button className="btn" style={{ flex:1, fontSize:"0.78rem" }} disabled={loading} onClick={() => action(() => botsApi.pause(bot.id))}>Pausar</button>}
        {bot.status === "running"  && <button className="btn" style={{ flex:1, fontSize:"0.78rem" }} disabled={loading} onClick={() => action(() => botsApi.stop(bot.id))}>Detener</button>}
        <button className="btn" style={{ fontSize:"0.78rem", background:"transparent", color:"#f87171", border:"1px solid #f8717133" }} disabled={loading}
          onClick={() => { if(confirm("Eliminar este bot?")) action(() => botsApi.delete(bot.id)); }}>
          x
        </button>
      </div>
    </div>
  );
}

function CreateBotModal({ onClose, onCreated }) {
  const [type,    setType]    = useState("dca_stock");
  const [name,    setName]    = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [cfg,     setCfg]     = useState({});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setCfg(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const bot = await botsApi.create({ type, name: name || TYPE_LABEL[type], config: cfg, sandbox });
      onCreated(bot); onClose();
    } catch(e) { setError(e.response?.data?.detail || "Error al crear bot"); }
    setLoading(false);
  };

  const renderForm = () => {
    if (type === "dca_stock") return (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Simbolo (ej: AAPL)" value={cfg.symbol||""} onChange={v => set("symbol", v.toUpperCase())} placeholder="AAPL" />
          <FieldSelect label="Bolsa" value={cfg.exchange||"NYSE"} onChange={v => set("exchange", v)} options={EXCHANGES} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Importe por compra (USD)" value={cfg.amount_usd||""} onChange={v => set("amount_usd", parseFloat(v)||0)} type="number" placeholder="100" />
          <Field label="Intervalo (minutos)" value={cfg.interval_minutes||1440} onChange={v => set("interval_minutes", parseInt(v)||1440)} type="number" placeholder="1440" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Take profit % (0=off)" value={cfg.take_profit_pct||0} onChange={v => set("take_profit_pct", parseFloat(v)||0)} type="number" placeholder="0" />
          <Field label="Stop loss % (0=off)" value={cfg.stop_loss_pct||0} onChange={v => set("stop_loss_pct", parseFloat(v)||0)} type="number" placeholder="0" />
        </div>
      </>
    );
    if (type === "momentum_stock") return (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Simbolo" value={cfg.symbol||""} onChange={v => set("symbol", v.toUpperCase())} placeholder="AAPL" />
          <FieldSelect label="Bolsa" value={cfg.exchange||"NYSE"} onChange={v => set("exchange", v)} options={EXCHANGES} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Capital (USD)" value={cfg.amount_usd||""} onChange={v => set("amount_usd", parseFloat(v)||0)} type="number" placeholder="500" />
          <Field label="Intervalo (min)" value={cfg.check_interval_minutes||60} onChange={v => set("check_interval_minutes", parseInt(v)||60)} type="number" placeholder="60" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0.5rem" }}>
          <Field label="RSI min entrada" value={cfg.rsi_min||55} onChange={v => set("rsi_min", parseFloat(v)||55)} type="number" placeholder="55" />
          <Field label="Take profit %" value={cfg.take_profit_pct||5} onChange={v => set("take_profit_pct", parseFloat(v)||5)} type="number" placeholder="5" />
          <Field label="Trailing stop %" value={cfg.trailing_stop_pct||2} onChange={v => set("trailing_stop_pct", parseFloat(v)||2)} type="number" placeholder="2" />
        </div>
      </>
    );
    if (type === "signal_stock") return (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Simbolo" value={cfg.symbol||""} onChange={v => set("symbol", v.toUpperCase())} placeholder="AAPL" />
          <FieldSelect label="Bolsa" value={cfg.exchange||"NYSE"} onChange={v => set("exchange", v)} options={EXCHANGES} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="Capital (USD)" value={cfg.amount_usd||""} onChange={v => set("amount_usd", parseFloat(v)||0)} type="number" placeholder="500" />
          <Field label="Intervalo (min)" value={cfg.check_interval_minutes||60} onChange={v => set("check_interval_minutes", parseInt(v)||60)} type="number" placeholder="60" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
          <Field label="RSI sobreventa (compra)" value={cfg.rsi_oversold||35} onChange={v => set("rsi_oversold", parseFloat(v)||35)} type="number" />
          <Field label="RSI sobrecompra (venta)" value={cfg.rsi_overbought||65} onChange={v => set("rsi_overbought", parseFloat(v)||65)} type="number" />
        </div>
      </>
    );
    if (type === "rebalance") return (
      <>
        <FieldSelect label="Bolsa" value={cfg.exchange||"NYSE"} onChange={v => set("exchange", v)} options={EXCHANGES} />
        <Field label="Capital total (USD)" value={cfg.total_capital_usd||""} onChange={v => set("total_capital_usd", parseFloat(v)||0)} type="number" placeholder="10000" />
        <div style={{ fontSize:"0.78rem", color:"var(--td)", marginBottom:3 }}>Objetivos (JSON, ej: {"{"}"AAPL":40,"MSFT":30,"GOOGL":30{"}"})</div>
        <textarea className="form-input" rows={3} style={{ fontFamily:"monospace", fontSize:"0.8rem" }}
          placeholder={'{"AAPL": 40, "MSFT": 30, "GOOGL": 30}'}
          onChange={e => { try { set("targets", JSON.parse(e.target.value)); } catch{} }} />
        <Field label="Intervalo chequeo (min)" value={cfg.check_interval_minutes||1440} onChange={v => set("check_interval_minutes", parseInt(v)||1440)} type="number" />
      </>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div className="card" style={{ width:"100%", maxWidth:520, padding:"1.5rem", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"1.25rem" }}>
          <h2 style={{ fontSize:"1rem", fontWeight:700 }}>Crear bot de acciones</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--td)", cursor:"pointer", fontSize:"1.2rem" }}>x</button>
        </div>

        {/* Tipo */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.5rem", marginBottom:"1rem" }}>
          {Object.entries(TYPE_LABEL).map(([t, label]) => (
            <div key={t} onClick={() => setType(t)} style={{
              padding:"0.6rem 0.75rem", borderRadius:8, cursor:"pointer",
              border: type===t ? `2px solid ${TYPE_COLOR[t]}` : "2px solid var(--bd)",
              background: type===t ? TYPE_COLOR[t]+"11":"var(--bg)",
            }}>
              <div style={{ fontWeight:700, fontSize:"0.82rem", color: type===t ? TYPE_COLOR[t]:"var(--ts)" }}>{label}</div>
              <div style={{ fontSize:"0.7rem", color:"var(--td)", marginTop:2 }}>{TYPE_DESC[t]}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ background:"#450a0a22", color:"#f87171", padding:"0.6rem", borderRadius:6, marginBottom:"0.75rem", fontSize:"0.82rem" }}>{error}</div>}

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
          <Field label="Nombre del bot (opcional)" value={name} onChange={setName} placeholder={TYPE_LABEL[type]} />
          {renderForm()}
          <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.84rem", cursor:"pointer" }}>
            <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
            <span>Sandbox (simular sin dinero real)</span>
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Creando..." : "Crear bot"}</button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", placeholder="" }) {
  return (
    <div>
      <div style={{ fontSize:"0.75rem", color:"var(--td)", marginBottom:3 }}>{label}</div>
      <input className="form-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize:"0.75rem", color:"var(--td)", marginBottom:3 }}>{label}</div>
      <select className="form-input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const SUGGESTED = [
  "Quiero acumular Apple a largo plazo",
  "Que bot va bien para el IBEX35?",
  "Quiero un bot de momentum para acciones USA",
  "Como funciona el rebalanceo automatico?",
];

function BotAdvisor() {
  const [open,     setOpen]    = useState(false);
  const [input,    setInput]   = useState("");
  const [response, setResp]    = useState("");
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState(null);

  const ask = async (msg) => {
    const q = (msg || input).trim(); if (!q) return;
    setInput(""); setLoading(true); setError(null); setResp("");
    try { const d = await botsApi.advisor(q); setResp(d.response); }
    catch(e) { setError(e.response?.data?.detail || "Error al consultar el asesor."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display:"flex", alignItems:"center", gap:"0.5rem",
        background: open ? "#0c4a6e33":"var(--su)", border:`1px solid ${open?"#0284c7":"#334155"}`,
        borderRadius:8, padding:"0.6rem 1rem", color: open?"#38bdf8":"var(--ts)",
        cursor:"pointer", fontSize:"0.88rem", fontWeight:600, width:"100%", textAlign:"left" }}>
        Asesor IA — recomendaciones de bots para acciones
        <span style={{ marginLeft:"auto", fontSize:"0.78rem", color:"var(--td)" }}>{open?"Cerrar":"Abrir"}</span>
      </button>
      {open && (
        <div className="card" style={{ borderTop:"2px solid #0284c7", borderTopLeftRadius:0, borderTopRightRadius:0, marginTop:0 }}>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => ask(s)} style={{ fontSize:"0.75rem", padding:"0.25rem 0.65rem", borderRadius:20, background:"#0c4a6e22", border:"1px solid #0284c744", color:"#38bdf8", cursor:"pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
            <input className="form-input" placeholder="Describe tu objetivo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && ask()} style={{ flex:1 }} disabled={loading} />
            <button className="btn btn-primary" onClick={() => ask()} disabled={loading || !input.trim()}>{loading ? "..." : "Preguntar"}</button>
          </div>
          {loading && <div style={{ padding:"1rem", textAlign:"center", color:"var(--td)", fontSize:"0.85rem" }}>Analizando...</div>}
          {error && <div style={{ padding:"0.75rem", background:"#450a0a22", borderRadius:8, color:"#f87171", fontSize:"0.82rem" }}>{error}</div>}
          {response && !loading && (
            <div style={{ padding:"1rem", background:"#0f172a", borderRadius:8, border:"1px solid #1e293b", fontSize:"0.84rem", lineHeight:1.7 }}>
              {response.split("\n").map((line, i) => (
                <div key={i} style={{ marginBottom:line===""?"0.5rem":"0.1rem", color:line.startsWith("?")?"#f59e0b":"var(--ts)", fontStyle:line.startsWith("?")?"italic":"normal" }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Bots() {
  const [bots,    setBots]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setModal] = useState(false);
  const [filter,  setFilter]  = useState("all");

  const load = useCallback(async () => {
    try { setBots(await botsApi.list()); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(() => { if (bots.some(b => b.status==="running")) load(); }, 5000); return () => clearInterval(id); }, [load, bots.length]);

  const filtered = filter === "all" ? bots : bots.filter(b => b.type === filter);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <h1 className="page-title" style={{ margin:0 }}>Bots de Trading</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Crear Bot</button>
      </div>

      {bots.length > 0 && (
        <div className="grid-4" style={{ marginBottom:"1.5rem" }}>
          {[
            { label:"Total",   value:bots.length,                           color:"var(--ts)" },
            { label:"Activos", value:bots.filter(b=>b.status==="running").length, color:"#4ade80" },
            { label:"Sandbox", value:bots.filter(b=>b.sandbox).length,      color:"#38bdf8" },
            { label:"P&L",     value:`${bots.reduce((s,b)=>s+(b.pnl||0),0)>=0?"+":""}$${bots.reduce((s,b)=>s+(b.pnl||0),0).toFixed(2)}`, color:bots.reduce((s,b)=>s+(b.pnl||0),0)>=0?"#4ade80":"#f87171" },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign:"center" }}>
              <div style={{ fontSize:"1.5rem", fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:"0.73rem", color:"var(--td)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <BotAdvisor />

      <div style={{ display:"flex", gap:"0.4rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {["all", ...Object.keys(TYPE_LABEL)].map(t => (
          <button key={t} className="btn" onClick={() => setFilter(t)} style={{
            fontSize:"0.8rem",
            background: filter===t ? (TYPE_COLOR[t]||"#0284c7"):"var(--su)",
            color: filter===t ? "#0f172a":"var(--ts)",
            border:"1px solid #334155", fontWeight: filter===t ? 700:400 }}>
            {t === "all" ? "Todos" : TYPE_LABEL[t]}
          </button>
        ))}
        <button className="btn" style={{ marginLeft:"auto", fontSize:"0.8rem" }} onClick={load}>Actualizar</button>
      </div>

      {loading && <p className="loading">Cargando bots...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"4rem 2rem" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🤖</div>
          <div style={{ color:"var(--td)", marginBottom:"1.5rem" }}>
            {bots.length === 0 ? "No hay bots creados todavia." : "Ningun bot coincide con el filtro."}
          </div>
          {bots.length === 0 && <button className="btn btn-primary" onClick={() => setModal(true)}>Crear mi primer bot</button>}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px,1fr))", gap:"1rem" }}>
        {filtered.map(bot => <BotCard key={bot.id} bot={bot} onRefresh={load} />)}
      </div>

      {bots.length === 0 && !loading && (
        <div style={{ marginTop:"3rem" }}>
          <h3 style={{ fontSize:"0.9rem", color:"var(--td)", marginBottom:"1rem" }}>TIPOS DE BOT DISPONIBLES</h3>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"0.75rem" }}>
            {Object.entries(TYPE_LABEL).map(([type, title]) => (
              <div key={type} className="card" style={{ borderTop:`3px solid ${TYPE_COLOR[type]}` }}>
                <div style={{ fontWeight:700, marginBottom:"0.4rem", color:TYPE_COLOR[type] }}>{title}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--td)", lineHeight:1.5 }}>{TYPE_DESC[type]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <CreateBotModal onClose={() => setModal(false)} onCreated={bot => { setBots(prev => [bot, ...prev]); }} />}
    </div>
  );
}
