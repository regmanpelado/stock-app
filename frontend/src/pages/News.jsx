import React, { useState, useEffect, useCallback } from 'react';
import { newsApi } from '../services/api.jsx';

const SOURCE_COLORS = {
  'CoinDesk':         '#f59e0b',
  'Cointelegraph':    '#3b82f6',
  'Decrypt':          '#8b5cf6',
  'The Block':        '#10b981',
  'Bitcoin Magazine': '#f97316',
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function isNew(ts) {
  return ts && Date.now() / 1000 - ts < 3600;
}

function NewsCard({ item, showOriginal, onToggleOriginal }) {
  const color      = SOURCE_COLORS[item.source] || 'var(--ts)';
  const hasTransl  = item.title_es && item.title_es !== item.title_original;
  const displayTitle = showOriginal ? (item.title_original || item.title) : (item.title_es || item.title);

  return (
    <div style={{
      background: 'var(--su)', border: '1px solid #1e3a5f55', borderRadius: 10,
      padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem',
          borderRadius: 20, background: color + '22', color, border: `1px solid ${color}44`,
        }}>
          {item.source}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isNew(item.published_at) && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 800, padding: '0.1rem 0.45rem',
              borderRadius: 20, background: '#14532d', color: '#4ade80',
              border: '1px solid #22c55e44',
            }}>NUEVO</span>
          )}
          <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>
            {timeAgo(item.published_at)}
          </span>
        </div>
      </div>

      {/* Title (clickable → opens article) */}
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{
          fontWeight: 700, fontSize: '0.9rem', color: 'var(--tx)',
          lineHeight: 1.4, marginBottom: '0.4rem',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {displayTitle}
        </div>
      </a>

      {/* Toggle "Ver original" / "Ver traducción" */}
      {hasTransl && (
        <button
          onClick={onToggleOriginal}
          style={{
            alignSelf: 'flex-start', marginBottom: '0.4rem',
            background: 'none', border: 'none', padding: 0,
            fontSize: '0.68rem', color: 'var(--t2)', cursor: 'pointer',
            textDecoration: 'underline', textDecorationStyle: 'dotted',
          }}>
          {showOriginal ? '🌐 Ver traducción' : '🔤 Ver original'}
        </button>
      )}

      {/* Description */}
      {item.description && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}>
          <div style={{
            fontSize: '0.78rem', color: 'var(--td)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.description}
          </div>
        </a>
      )}

      {/* Footer */}
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: 'none' }}>
        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--bd)', fontWeight: 600 }}>
          Leer artículo →
        </div>
      </a>
    </div>
  );
}

export default function News() {
  const [news,         setNews]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [activeSource, setActiveSource] = useState('Todos');
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  // Set de URLs cuya card muestra el título original en inglés
  const [showOriginals, setShowOriginals] = useState(new Set());

  const sources = ['Todos', 'CoinDesk', 'Cointelegraph', 'Decrypt', 'The Block', 'Bitcoin Magazine'];

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const data = await newsApi.getNews(80);
      setNews(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const toggleOriginal = (url) => {
    setShowOriginals(prev => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const filtered = news.filter(item => {
    const matchSource = activeSource === 'Todos' || item.source === activeSource;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (item.title_es       || item.title).toLowerCase().includes(q) ||
      (item.title_original || item.title).toLowerCase().includes(q);
    return matchSource && matchSearch;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Noticias Cripto</h1>
          <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
            {lastUpdate && `Actualizado ${timeAgo(lastUpdate.getTime() / 1000)}`}
            {refreshing && <span style={{ color: '#38bdf8', marginLeft: 6 }}>↻ Actualizando...</span>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => load(false)}
          style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {sources.map(src => {
            const color  = src === 'Todos' ? 'var(--ts)' : (SOURCE_COLORS[src] || 'var(--ts)');
            const active = activeSource === src;
            return (
              <button key={src} onClick={() => setActiveSource(src)}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                  border: `1px solid ${active ? color : 'var(--bd)'}`,
                  background: active ? color + '22' : 'transparent',
                  color: active ? color : 'var(--td)', cursor: 'pointer',
                }}>
                {src}
              </button>
            );
          })}
        </div>
        <input
          className="form-input"
          placeholder="Buscar noticias..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, maxWidth: 300, fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
        />
      </div>

      {/* Contador */}
      {!loading && (
        <div style={{ fontSize: '0.75rem', color: 'var(--t2)', marginBottom: '1rem' }}>
          {filtered.length} artículos
          {activeSource !== 'Todos' && ` de ${activeSource}`}
          {search && ` con "${search}"`}
          <span style={{ color: 'var(--bd)', marginLeft: 8 }}>· Títulos traducidos al español</span>
        </div>
      )}

      {/* Estados */}
      {loading && <p className="loading">Cargando y traduciendo noticias...</p>}
      {error   && <p className="error-msg">{error}</p>}

      {/* Grid de noticias */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--t2)' }}>
              No se encontraron noticias
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
            }}>
              {filtered.map((item, i) => (
                <NewsCard
                  key={item.url || i}
                  item={item}
                  showOriginal={showOriginals.has(item.url)}
                  onToggleOriginal={() => toggleOriginal(item.url)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--bd)', fontSize: '0.72rem', marginTop: '1rem' }}>
          Fuentes: CoinDesk · Cointelegraph · Decrypt · The Block · Bitcoin Magazine
          · Traducción automática por MyMemory · Se actualiza cada 5 min
        </div>
      )}
    </div>
  );
}
