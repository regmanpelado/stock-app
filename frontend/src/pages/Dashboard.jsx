import React, { useState, useEffect } from "react";
import { marketApi, portfolioApi, botsApi, newsApi } from "../services/api.jsx";

function IndexCard({ idx }) {
  const pos = idx.change_pct >= 0;
  return (
    <div className="card" style={{ padding: "0.85rem 1rem", minWidth: 150 }}>
      <div style={{ fontSize: "0.7rem", color: "var(--td)", fontWeight: 600, marginBottom: 2 }}>{idx.region}</div>
      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ts)", marginBottom: 4 }}>{idx.name}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--tx)" }}>
        {idx.price?.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
      </div>
      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: pos ? "#4ade80" : "#f87171", marginTop: 2 }}>
        {pos ? "+" : ""}{idx.change_pct?.toFixed(2)}%
      </div>
    </div>
  );
}

function PortfolioSummary({ summary }) {
  if (!summary || summary.count === 0) return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontSize: "0.85rem", color: "var(--td)", marginBottom: "0.75rem", fontWeight: 600 }}>MI PORTFOLIO</h3>
      <div style={{ color: "var(--td)", fontSize: "0.85rem" }}>Sin posiciones. Ve a Portfolio para añadir acciones.</div>
    </div>
  );
  const pos = summary.total_pnl >= 0;
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontSize: "0.85rem", color: "var(--td)", marginBottom: "1rem", fontWeight: 600 }}>MI PORTFOLIO</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem", textAlign: "center" }}>
        {[
          { label: "Valor total",   value: `$${(summary.total_value||0).toFixed(2)}`,      color: "var(--ts)" },
          { label: "Invertido",     value: `$${(summary.total_invested||0).toFixed(2)}`,   color: "var(--td)" },
          { label: "P&L total",     value: `${pos?"+":""}$${(summary.total_pnl||0).toFixed(2)}`, color: pos?"#4ade80":"#f87171" },
          { label: "Rentabilidad",  value: `${pos?"+":""}${(summary.total_pnl_pct||0).toFixed(2)}%`, color: pos?"#4ade80":"#f87171" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--td)" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--td)", textAlign: "center" }}>
        {summary.count} posicion{summary.count !== 1 ? "es" : ""}
      </div>
    </div>
  );
}

function BotsSummary({ bots }) {
  const running  = bots.filter(b => b.status === "running").length;
  const totalPnl = bots.reduce((s, b) => s + (b.pnl || 0), 0);
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontSize: "0.85rem", color: "var(--td)", marginBottom: "1rem", fontWeight: 600 }}>BOTS ACTIVOS</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#4ade80" }}>{running}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--td)" }}>Activos</div>
        </div>
        <div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ts)" }}>{bots.length}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--td)" }}>Total</div>
        </div>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: totalPnl >= 0 ? "#4ade80" : "#f87171" }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--td)" }}>P&L</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [indices,   setIndices]   = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [bots,      setBots]      = useState([]);
  const [news,      setNews]      = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      marketApi.getIndices().catch(() => []),
      portfolioApi.get().catch(() => null),
      botsApi.list().catch(() => []),
      newsApi.getNews(6).catch(() => []),
    ]).then(([idx, port, b, n]) => {
      setIndices(idx); setPortfolio(port); setBots(b); setNews(n);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="loading">Cargando dashboard...</p>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "0.8rem", color: "var(--td)", fontWeight: 600, marginBottom: "0.75rem" }}>INDICES MUNDIALES</h2>
        <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          {indices.length === 0
            ? <div style={{ color: "var(--td)", fontSize: "0.85rem" }}>Cargando indices...</div>
            : indices.map(idx => <IndexCard key={idx.ticker} idx={idx} />)}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <PortfolioSummary summary={portfolio?.summary} />
        <BotsSummary bots={bots} />
      </div>

      {portfolio?.positions?.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "0.85rem", color: "var(--td)", marginBottom: "1rem", fontWeight: 600 }}>MIS POSICIONES</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ color: "var(--td)", fontSize: "0.72rem" }}>
                  {["Simbolo","Acciones","Precio compra","Precio actual","Valor","P&L"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.5rem", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.slice(0,5).map(p => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--bd)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 700, color: "#38bdf8" }}>{p.symbol}</td>
                    <td style={{ padding: "0.5rem", color: "var(--ts)" }}>{p.shares}</td>
                    <td style={{ padding: "0.5rem", color: "var(--ts)" }}>${p.avg_price?.toFixed(2)}</td>
                    <td style={{ padding: "0.5rem", color: "var(--ts)" }}>${p.current_price?.toFixed(2)}</td>
                    <td style={{ padding: "0.5rem", color: "var(--ts)" }}>${p.value?.toFixed(2)}</td>
                    <td style={{ padding: "0.5rem", fontWeight: 700, color: p.pnl >= 0 ? "#4ade80" : "#f87171" }}>
                      {p.pnl >= 0 ? "+" : ""}${p.pnl?.toFixed(2)} ({p.pnl_pct?.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {news.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ fontSize: "0.85rem", color: "var(--td)", marginBottom: "0.5rem", fontWeight: 600 }}>ULTIMAS NOTICIAS</h3>
          {news.map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
               style={{ display: "block", padding: "0.65rem 0", borderBottom: "1px solid var(--bd)", textDecoration: "none", color: "inherit" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ts)", marginBottom: 2, lineHeight: 1.4 }}>{n.title}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--td)" }}>{n.source} - {new Date(n.published).toLocaleDateString("es-ES")}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
