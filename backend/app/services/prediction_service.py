"""Motor de predicción de precios con Gradient Boosting + features técnicas."""
import time
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from datetime import datetime, timezone

from app.services.signals_service import compute_rsi, compute_macd, compute_bollinger
from app.services.exchange_service import fetch_ohlcv

# ── Caché de modelos (TTL 1 hora por símbolo/timeframe) ───────────────────────
_cache: dict[str, dict] = {}
_CACHE_TTL = 3600


def _cached(key: str):
    c = _cache.get(key)
    if c and time.time() - c["ts"] < _CACHE_TTL:
        return c["model"], c["scaler"]
    return None, None


def _store(key: str, model, scaler):
    _cache[key] = {"model": model, "scaler": scaler, "ts": time.time()}


# ── Ingeniería de features ────────────────────────────────────────────────────

def _features(closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    rows = []
    n = len(closes)
    for i in range(50, n):
        c = closes
        v = volumes
        p = c[i]

        def ret(lag):   return (c[i] / c[i - lag] - 1) if i >= lag else 0.0
        def sma(lag):   return np.mean(c[i - lag:i]) if i >= lag else p
        def vol_sma(l): return np.mean(v[i - l:i]) if i >= l else v[i]

        rsi   = compute_rsi(c[max(0, i - 30):i + 1].tolist()) or 50.0
        _, _, hist = compute_macd(c[max(0, i - 50):i + 1].tolist())
        hist  = hist or 0.0
        bb_u, _, bb_l = compute_bollinger(c[max(0, i - 20):i + 1].tolist())
        pct_b = (p - bb_l) / (bb_u - bb_l) if bb_u and bb_l and bb_u != bb_l else 0.5
        rets  = np.diff(c[max(0, i - 20):i + 1]) / c[max(0, i - 20):i]
        vola  = float(np.std(rets)) if len(rets) > 1 else 0.0
        vr    = v[i] / vol_sma(10) if vol_sma(10) > 0 else 1.0

        rows.append([
            ret(1), ret(5), ret(10), ret(20),
            p / sma(10) - 1, p / sma(20) - 1, p / sma(50) - 1,
            rsi / 100, hist / p if p else 0,
            pct_b, vola, min(vr, 10),
        ])
    return np.array(rows, dtype=float)


# ── Entrenamiento ─────────────────────────────────────────────────────────────

def _train(X: np.ndarray, y: np.ndarray):
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    model = GradientBoostingRegressor(
        n_estimators=120, max_depth=4, learning_rate=0.08,
        subsample=0.8, min_samples_leaf=5, random_state=42,
    )
    model.fit(Xs, y)
    return model, scaler


# ── Predicción iterativa ──────────────────────────────────────────────────────

def _predict_steps(model, scaler, last_feat: np.ndarray, price: float, steps: int):
    preds = []
    feat = last_feat.copy()
    p = price
    for _ in range(steps):
        Xs = scaler.transform(feat.reshape(1, -1))
        r = float(model.predict(Xs)[0])
        r = max(-0.15, min(0.15, r))          # clamp ±15 % por paso
        p = p * (1 + r)
        preds.append({"price": round(p, 2), "return_pct": round(r * 100, 4)})
        feat[0] = r                            # actualiza ret_1 para el siguiente paso
    return preds


# ── API pública ───────────────────────────────────────────────────────────────

FEATURE_NAMES = [
    "ret_1", "ret_5", "ret_10", "ret_20",
    "vs_sma10", "vs_sma20", "vs_sma50",
    "rsi", "macd_norm", "bb_pct", "volatilidad", "vol_ratio",
]

HORIZON_LABELS = {"1h": 1, "4h": 4, "8h": 8, "24h": 24}


async def predict_price(exchange: str, symbol: str,
                        timeframe: str = "1h", horizon: int = 24) -> dict:
    key = f"{exchange}_{symbol}_{timeframe}"
    try:
        candles = await fetch_ohlcv(exchange, symbol, timeframe, limit=250)
        closes  = np.array([c["close"]  for c in candles], dtype=float)
        volumes = np.array([c["volume"] for c in candles], dtype=float)

        if len(closes) < 70:
            return {"error": "Datos insuficientes (mínimo 70 velas)"}

        # Features y target (retorno del siguiente periodo)
        X_all = _features(closes, volumes)
        y_all = np.array(
            [(closes[50 + i + 1] / closes[50 + i] - 1) for i in range(len(X_all) - 1)],
            dtype=float,
        )
        X_all = X_all[: len(y_all)]

        # Usar modelo cacheado o entrenar uno nuevo
        model, scaler = _cached(key)
        if model is None:
            model, scaler = _train(X_all, y_all)
            _store(key, model, scaler)

        # Score de confianza
        cv = cross_val_score(model, scaler.transform(X_all), y_all, cv=3, scoring="r2")
        r2 = float(max(0, np.mean(cv)))
        vola = float(np.std(np.diff(closes[-30:]) / closes[-30:-1]))
        confianza = max(12, min(93, r2 * 100 - min(25, vola * 800)))

        # Predicciones
        preds = _predict_steps(model, scaler, X_all[-1], float(closes[-1]), min(horizon, 24))

        horizons = {}
        for label, step in HORIZON_LABELS.items():
            if step <= len(preds):
                horizons[label] = preds[step - 1]

        # Tendencia
        p24 = preds[min(23, len(preds) - 1)]["price"]
        cp  = float(closes[-1])
        diff_pct = (p24 - cp) / cp * 100
        if diff_pct > 0.5:     tendencia = "alcista"
        elif diff_pct < -0.5:  tendencia = "bajista"
        else:                  tendencia = "lateral"

        # Importancia de features (top 3)
        imp = model.feature_importances_
        top = sorted(zip(FEATURE_NAMES, imp), key=lambda x: x[1], reverse=True)[:3]

        return {
            "symbol": symbol, "exchange": exchange, "timeframe": timeframe,
            "precio_actual": cp,
            "modelo": "Gradient Boosting Regressor (ventana deslizante LSTM-style)",
            "confianza": round(confianza, 1),
            "tendencia": tendencia,
            "cambio_24h_pct": round(diff_pct, 3),
            "predicciones": preds,
            "horizontes": horizons,
            "soporte":    round(min(p["price"] for p in preds), 2),
            "resistencia": round(max(p["price"] for p in preds), 2),
            "features_top": [{"nombre": n, "importancia": round(v * 100, 1)} for n, v in top],
            "r2_score": round(r2, 4),
            "generado_en": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        return {
            "symbol": symbol, "exchange": exchange, "error": str(e),
            "confianza": 0, "tendencia": "desconocido",
        }


async def predict_multi(symbols: list[tuple[str, str]], timeframe: str = "1h") -> list[dict]:
    """Predice varios pares en paralelo (usado por el screener de IA)."""
    import asyncio
    tasks = [predict_price(ex, sym, timeframe) for ex, sym in symbols]
    return await asyncio.gather(*tasks)
