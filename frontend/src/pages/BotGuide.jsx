import React, { useState } from 'react';

const RISK_COLOR = { 'Bajo': '#4ade80', 'Medio': '#f59e0b', 'Alto': '#f87171', 'Muy alto': '#dc2626' };

const BOTS = [
  {
    type: 'dca',
    color: '#38bdf8',
    label: 'Bot DCA',
    subtitle: 'Dollar Cost Averaging',
    risk: 'Bajo',
    strategy: 'Acumulación',
    description: 'Compra una cantidad fija del activo a intervalos regulares independientemente del precio. Promedia el coste de adquisición a lo largo del tiempo, reduciendo el impacto de la volatilidad.',
    how: [
      'Cada N minutos/horas compra exactamente la misma cantidad en moneda quote (ej: 50 €)',
      'Calcula la cantidad base equivalente al precio de mercado en ese momento',
      'Actualiza el coste medio ponderado tras cada compra',
      'Registra P&L no realizado vs precio actual de mercado',
    ],
    entry: 'Automática — cada N minutos según el intervalo configurado.',
    exit: 'No tiene salida automática. El usuario debe vender manualmente desde Portfolio.',
    params: [
      { name: 'symbol', desc: 'Par de trading, ej: BTC/EUR' },
      { name: 'amount', desc: 'Importe en moneda quote por cada compra (ej: 50 €)' },
      { name: 'interval_minutes', desc: 'Minutos entre compras (60 = cada hora)' },
    ],
    best: 'Mercados volátiles a largo plazo. Perfecto para acumular BTC/ETH sin preocuparse del timing.',
    avoid: 'Activos con tendencia bajista estructural a largo plazo.',
    pros: ['Elimina el estrés de elegir el momento de compra', 'Reduce el riesgo de comprar en máximos', 'Configuración mínima'],
    cons: ['Sin salida automática', 'No optimiza el precio de entrada', 'Acumula sin límite'],
  },
  {
    type: 'grid',
    color: '#a78bfa',
    label: 'Bot Grid Trading',
    subtitle: 'Grid Trading Avanzado',
    risk: 'Medio',
    strategy: 'Neutral / Rango',
    description: 'Divide un rango de precios en N niveles equidistantes. Compra cuando el precio cae a un nivel y vende cuando sube al nivel siguiente, capturando las oscilaciones del mercado.',
    how: [
      'Calcula N niveles de precio entre el mínimo y máximo configurados',
      'Cuando el precio baja al nivel i → ejecuta compra',
      'Cuando el precio sube al nivel i+1 → ejecuta venta y registra beneficio',
      'Opcionalmente: ajusta el rango con Bollinger Bands (Grid Dinámico)',
      'Opcionalmente: desplaza el grid hacia arriba si el precio sube del máximo (Trailing)',
      'Opcionalmente: pausa si el precio cae bruscamente (Protección de Tendencia)',
      'Opcionalmente: reinvierte los beneficios en los siguientes lotes (Reinversión)',
    ],
    entry: 'Precio baja al nivel i del grid (compra). Precio sube al nivel i+1 (venta).',
    exit: 'Automática en cada cruce de nivel. Stop manual o por Protección de Tendencia.',
    params: [
      { name: 'lower_price / upper_price', desc: 'Rango de precios del grid' },
      { name: 'grid_levels', desc: 'Número de divisiones del rango (2-20)' },
      { name: 'amount_per_grid', desc: 'Cantidad base a comprar/vender por nivel' },
      { name: 'dynamic_grid', desc: 'Reajusta el rango con Bollinger Bands (4h)' },
      { name: 'trailing_grid', desc: 'Mueve el grid arriba cuando el precio supera el máximo' },
      { name: 'trend_protection', desc: 'Auto-pausa si el precio cae X% bajo el mínimo' },
      { name: 'reinvest_profits', desc: 'Los beneficios de ventas aumentan el siguiente lote' },
    ],
    best: 'Mercados laterales o con alta volatilidad dentro de un rango definido.',
    avoid: 'Tendencias fuertes — el precio puede salir del rango y quedarse con posiciones perdedoras.',
    pros: ['Genera beneficios en mercados laterales', 'Opciones avanzadas de gestión', 'Eficiencia medible'],
    cons: ['Ineficaz en tendencias fuertes', 'Requiere calibrar bien el rango', 'Riesgo de inventario acumulado'],
  },
  {
    type: 'signal',
    color: '#fb923c',
    label: 'Bot de Señales',
    subtitle: 'RSI + MACD',
    risk: 'Medio',
    strategy: 'Técnico',
    description: 'Opera siguiendo señales de indicadores técnicos RSI y MACD. Compra cuando detecta sobreventa y vende cuando detecta sobrecompra o reversión del momentum.',
    how: [
      'Cada N minutos analiza RSI y MACD del símbolo en el timeframe configurado',
      'Señal de compra: RSI < rsi_oversold (sobrevendido) O MACD histograma positivo',
      'Señal de venta: RSI > rsi_overbought (sobrecomprado) O MACD histograma negativo',
      'Solo compra si no hay posición abierta, solo vende si hay posición',
    ],
    entry: 'RSI < umbral de sobreventa (default 30) O MACD histograma positivo.',
    exit: 'RSI > umbral de sobrecompra (default 70) O MACD histograma negativo.',
    params: [
      { name: 'timeframe', desc: 'Temporalidad para calcular indicadores (15m, 1h, 4h, 1d)' },
      { name: 'rsi_oversold', desc: 'RSI bajo este valor = señal de compra (default 30)' },
      { name: 'rsi_overbought', desc: 'RSI sobre este valor = señal de venta (default 70)' },
      { name: 'use_rsi / use_macd', desc: 'Activar/desactivar cada indicador individualmente' },
      { name: 'check_interval_minutes', desc: 'Frecuencia de análisis en minutos' },
    ],
    best: 'Activos con ciclos técnicos claros. Timeframes de 1h a 4h para swing trading.',
    avoid: 'Mercados en tendencia fuerte — RSI puede mantenerse en zona extrema mucho tiempo.',
    pros: ['Lógica simple y comprensible', 'Funciona en múltiples timeframes', 'Personalizable'],
    cons: ['Sin stop-loss ni take-profit automático', 'Señales falsas en tendencias', 'Solo una posición a la vez'],
  },
  {
    type: 'ia_dynamic',
    color: '#34d399',
    label: 'Bot IA Dinámico',
    subtitle: 'Portfolio Automático con IA',
    risk: 'Medio',
    strategy: 'Multi-activo / IA',
    description: 'Analiza automáticamente las N criptomonedas con más volumen, puntúa cada una con indicadores técnicos e IA predictiva, y gestiona un portfolio de las mejores oportunidades sin intervención.',
    how: [
      'Cada hora escanea las top N criptos por volumen en la moneda de cotización elegida',
      'Calcula un score combinado: RSI (±2pts) + MACD (±2pts) + Bollinger (±1pt) + IA predictiva (±3pts)',
      'Mantiene las top max_positions con mayor score que superen min_score',
      'Vende posiciones que caen del ranking o tienen score negativo',
      'Compra nuevas posiciones que entran al top con buen score',
      'Actualiza precios y P&L en tiempo real tras cada escaneo',
    ],
    entry: 'Score ≥ min_score Y ranking entre las top max_positions por volumen.',
    exit: 'Score < 0 O símbolo cayó del top N por volumen O score insuficiente.',
    params: [
      { name: 'quote_currency', desc: 'Moneda de cotización para filtrar pares (USDT, EUR, BTC)' },
      { name: 'max_positions', desc: 'Máximo de posiciones simultáneas (3-5)' },
      { name: 'capital_per_position', desc: 'Capital invertido por cada posición' },
      { name: 'top_n_volume', desc: 'Número de criptos a analizar (10-100)' },
      { name: 'min_score', desc: 'Score mínimo para entrar (1-5 recomendado)' },
      { name: 'use_ai', desc: 'Incluir predicción ML en el score' },
    ],
    best: 'Mercados con alta liquidez y movimiento. Ideal para gestión automatizada diversificada.',
    avoid: 'Mercados muy bajistas — puede acumular pérdidas en múltiples posiciones simultáneamente.',
    pros: ['Totalmente autónomo', 'Diversificación automática', 'Combina técnica e IA'],
    cons: ['Requiere mayor capital', 'Escaneo intensivo cada hora', 'Difícil de predecir el comportamiento'],
  },
  {
    type: 'market_making',
    color: '#f59e0b',
    label: 'Bot Market Making',
    subtitle: 'Captura de Spread',
    risk: 'Medio-Alto',
    strategy: 'Neutral',
    description: 'Publica órdenes de compra (bids) y venta (asks) a ambos lados del precio actual. Gana el diferencial entre el precio de compra y venta cuando ambos lados se ejecutan.',
    how: [
      'Calcula niveles bid y ask: bid = mid × (1 - spread/2), ask = mid × (1 + spread/2)',
      'Detecta cuando el precio cruza hacia abajo un nivel bid → ejecuta compra',
      'Detecta cuando el precio cruza hacia arriba un nivel ask → ejecuta venta',
      'Controla el inventario máximo para no acumular demasiada posición larga',
      'Actualiza los niveles en cada ciclo de refresco',
    ],
    entry: 'Precio cae y cruza un nivel bid (compra virtual ejecutada).',
    exit: 'Precio sube y cruza un nivel ask (venta con spread ganado).',
    params: [
      { name: 'spread_pct', desc: 'Spread total en % entre bid y ask (ej: 0.5%)' },
      { name: 'order_size', desc: 'Cantidad base por orden (ambos lados)' },
      { name: 'levels', desc: 'Número de niveles por lado (1-5)' },
      { name: 'refresh_interval', desc: 'Segundos entre actualizaciones de precios' },
      { name: 'max_inventory', desc: 'Máxima posición larga acumulable en moneda base' },
    ],
    best: 'Activos con alta liquidez y volatilidad moderada. BTC/USDT, ETH/USDT.',
    avoid: 'Activos con spreads naturales muy amplios o tendencias fuertes unidireccionales.',
    pros: ['Beneficio en mercados laterales', 'Ingresos recurrentes de spread', 'Escalable con más niveles'],
    cons: ['Riesgo de inventario en tendencias', 'Necesita ajuste continuo del spread', 'Requiere liquidez en el activo'],
  },
  {
    type: 'arbitrage',
    color: '#e879f9',
    label: 'Bot Arbitraje',
    subtitle: 'Arbitraje Cross-Exchange',
    risk: 'Bajo-Medio',
    strategy: 'Market-Neutral',
    description: 'Monitoriza el mismo par de trading en dos exchanges simultáneamente. Cuando el precio difiere más del umbral configurado, compra en el exchange más barato y vende en el más caro.',
    how: [
      'Cada N segundos consulta el precio en ambos exchanges en paralelo',
      'Calcula el spread: (precio_alto - precio_bajo) / precio_bajo × 100',
      'Si spread ≥ min_spread_pct → compra en el exchange barato, vende en el caro',
      'Determina automáticamente qué exchange es compra y cuál es venta',
      'Registra cada oportunidad detectada aunque no se ejecute',
    ],
    entry: 'Spread entre exchanges ≥ umbral mínimo configurado.',
    exit: 'Inmediata — la posición se abre y cierra en el mismo ciclo (compra + venta simultáneas).',
    params: [
      { name: 'exchange_a / exchange_b', desc: 'Los dos exchanges a monitorizar' },
      { name: 'symbol', desc: 'Par que debe existir en ambos exchanges' },
      { name: 'amount', desc: 'Capital en moneda quote por operación' },
      { name: 'min_spread_pct', desc: 'Spread mínimo para ejecutar (default 0.3%) — debe cubrir comisiones' },
      { name: 'check_interval', desc: 'Segundos entre escaneos (default 10s)' },
    ],
    best: 'Mercados con diferencias de precio frecuentes entre exchanges. Más efectivo en alta volatilidad.',
    avoid: 'Pares con baja liquidez donde el slippage puede eliminar el beneficio del arbitraje.',
    pros: ['Estrategia market-neutral (baja exposición direccional)', 'Riesgo acotado', 'Rendimiento independiente de la dirección del mercado'],
    cons: ['Oportunidades cada vez más escasas', 'Requiere saldo en ambos exchanges', 'Comisiones pueden erosionar el beneficio'],
  },
  {
    type: 'scalping',
    color: '#f43f5e',
    label: 'Bot Scalping',
    subtitle: 'Operaciones Rápidas',
    risk: 'Alto',
    strategy: 'Momentum corto plazo',
    description: 'Abre y cierra posiciones muy rápidamente en timeframes cortos (1m-15m) buscando pequeños movimientos de precio. Usa RSI y MACD como filtros de entrada, con take-profit y stop-loss muy ajustados.',
    how: [
      'Analiza RSI y MACD cada N segundos en el timeframe configurado (1m, 3m, 5m, 15m)',
      'Señal de entrada: RSI < umbral (sobrevendido) Y MACD histograma positivo (momentum)',
      'Si hay posición: comprueba TP, SL, señal girada y tiempo máximo en cada ciclo',
      'Sale inmediatamente al cumplirse cualquiera de las 4 condiciones de salida',
      'Registra el motivo de cada cierre para análisis posterior',
    ],
    entry: 'RSI < rsi_entry (default 45) Y MACD histograma > 0 simultáneamente.',
    exit: '(1) Take profit %, (2) Stop loss %, (3) RSI > 70 o MACD giró bajista, (4) Tiempo máximo superado.',
    params: [
      { name: 'timeframe', desc: 'Temporalidad corta: 1m, 3m, 5m o 15m' },
      { name: 'take_profit_pct', desc: 'Ganancia para cerrar posición (default 0.5%)' },
      { name: 'stop_loss_pct', desc: 'Pérdida máxima antes de cortar (default 0.3%)' },
      { name: 'rsi_entry', desc: 'RSI máximo para entrar en largo (default 45)' },
      { name: 'check_interval', desc: 'Segundos entre análisis (default 30s)' },
      { name: 'max_open_minutes', desc: 'Minutos máximos con posición abierta (default 60)' },
    ],
    best: 'Mercados con alta volatilidad intradía. BTC/USDT, ETH/USDT en momentos de movimiento.',
    avoid: 'Mercados sin volumen o con spreads amplios donde el slippage supera el take-profit.',
    pros: ['Muchas oportunidades diarias', 'Stop-loss y TP protegen capital', 'Rotación rápida de capital'],
    cons: ['Más comisiones por mayor número de trades', 'Requiere seguimiento constante', 'Señales falsas frecuentes en 1m-3m'],
  },
  {
    type: 'mean_reversion',
    color: '#06b6d4',
    label: 'Bot Mean Reversion',
    subtitle: 'Reversión a la Media',
    risk: 'Medio',
    strategy: 'Contrarian',
    description: 'Basado en la estadística de que los precios tienden a volver a su media histórica. Compra cuando el precio se aleja excesivamente hacia abajo (Bollinger inferior) y vende cuando regresa al equilibrio.',
    how: [
      'Calcula Bollinger Bands (SMA20, ±2σ) en el timeframe configurado',
      'Señal de entrada: precio cruza bajo la banda inferior (sobreextendido)',
      'Confirmación opcional: RSI < umbral de sobreventa para evitar trampas bajistas',
      'Espera que el precio regrese a la media (SMA20) o la banda superior según config',
      'Barra visual en la tarjeta muestra el %B (posición del precio en las bandas)',
    ],
    entry: 'Precio ≤ banda inferior de Bollinger + (opcional) RSI < rsi_oversold.',
    exit: '(1) Precio recupera la media SMA20 (modo conservador), (2) Precio alcanza banda superior (agresivo), (3) RSI > 65, (4) Stop loss %, (5) Tiempo máximo.',
    params: [
      { name: 'timeframe', desc: 'Timeframe para Bollinger: 15m, 1h, 4h, 1d' },
      { name: 'rsi_confirm', desc: 'Confirmar entrada con RSI sobrevendido' },
      { name: 'rsi_oversold', desc: 'Umbral RSI para confirmación (default 35)' },
      { name: 'exit_at_mean', desc: 'True = salir en SMA20 (conservador), False = salir en banda superior (agresivo)' },
      { name: 'stop_loss_pct', desc: 'Stop-loss % desde entrada (default 3%)' },
      { name: 'max_open_hours', desc: 'Horas máximas en posición (default 48h)' },
    ],
    best: 'Mercados en rango con alta volatilidad. Activos que muestran históricamente reversión a la media.',
    avoid: 'Tendencias bajistas fuertes — el precio puede mantenerse bajo la banda inferior mucho tiempo.',
    pros: ['Alta win rate en mercados normales', 'Compra en mínimos relativos', 'Stop-loss bien definido'],
    cons: ['En tendencias bajistas puede activar el SL repetidamente', 'Requiere paciencia (posiciones en 1h-4h)'],
  },
  {
    type: 'momentum',
    color: '#84cc16',
    label: 'Bot Momentum',
    subtitle: 'Seguimiento de Tendencia',
    risk: 'Medio-Alto',
    strategy: 'Trend Following',
    description: 'Estrategia opuesta al mean reversion. Compra fortaleza (activos que ya están subiendo) y monta la tendencia alcista hasta que el impulso se agota. Usa trailing stop dinámico para proteger ganancias.',
    how: [
      'Analiza RSI, MACD y Bollinger Bands en el timeframe configurado',
      'Calcula un Momentum Score (0-90): RSI sobre 50 aporta hasta 40pts, MACD positivo 30pts, precio sobre BB media 20pts',
      'Entra cuando RSI está en zona momentum (55-75) + MACD positivo + precio sobre BB media',
      'Registra el precio máximo (pico) alcanzado desde la entrada',
      'El trailing stop sigue el pico — si el precio cae X% del máximo, cierra',
    ],
    entry: 'rsi_min ≤ RSI ≤ rsi_max Y MACD histograma > 0 Y precio > BB media.',
    exit: '(1) Take profit %, (2) Trailing stop desde pico (más importante), (3) Stop loss fijo %, (4) RSI > rsi_max+5, (5) MACD giró bajista, (6) Tiempo máximo.',
    params: [
      { name: 'rsi_min', desc: 'RSI mínimo para entrar — confirma momentum (default 55)' },
      { name: 'rsi_max', desc: 'RSI máximo para entrar — evita sobrecompra (default 75)' },
      { name: 'take_profit_pct', desc: 'TP fijo % (default 3%)' },
      { name: 'stop_loss_pct', desc: 'SL fijo % desde entrada (default 2%)' },
      { name: 'trailing_stop_pct', desc: 'Trailing stop % desde el precio máximo alcanzado (default 1.5%)' },
      { name: 'max_open_hours', desc: 'Horas máximas en posición (default 24h)' },
    ],
    best: 'Mercados alcistas con tendencia clara. Bull markets. Alta volatilidad con dirección.',
    avoid: 'Mercados laterales o bajistas — las entradas en momentum pueden convertirse en trampas alcistas.',
    pros: ['El trailing stop maximiza ganancias en tendencias largas', 'Score visual del momentum', 'No compra debilidad'],
    cons: ['En mercados laterales genera falsas entradas', 'Puede entrar tarde en el movimiento', 'Trailing stop puede activarse prematuramente'],
  },
];

const CATEGORIES = {
  todos: 'Todos',
  acumulacion: 'Acumulación',
  neutral: 'Neutral / Rango',
  tecnico: 'Técnico',
  tendencia: 'Tendencia',
};

const BOT_CATEGORY = {
  dca: 'acumulacion', grid: 'neutral', signal: 'tecnico', ia_dynamic: 'tecnico',
  market_making: 'neutral', arbitrage: 'neutral', scalping: 'tendencia',
  mean_reversion: 'tecnico', momentum: 'tendencia',
};

function RiskBadge({ risk }) {
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 4,
      background: (RISK_COLOR[risk.split('-')[0]] || '#f59e0b') + '22',
      color: RISK_COLOR[risk.split('-')[0]] || '#f59e0b', border: `1px solid ${RISK_COLOR[risk.split('-')[0]] || '#f59e0b'}44`,
    }}>
      {risk}
    </span>
  );
}

function BotGuideCard({ bot, expanded, onToggle }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${bot.color}`, cursor: 'pointer' }}
      onClick={onToggle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 4,
              background: bot.color + '22', color: bot.color }}>
              {bot.label}
            </span>
            <RiskBadge risk={bot.risk} />
            <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0.15rem 0.4rem',
              background: '#1e293b', borderRadius: 4, border: '1px solid #334155' }}>
              {bot.strategy}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{bot.subtitle}</div>
        </div>
        <span style={{ color: '#64748b', fontSize: '0.9rem', flexShrink: 0, marginLeft: '0.5rem' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--td)', lineHeight: 1.6, marginBottom: expanded ? '1rem' : 0 }}>
        {bot.description}
      </p>

      {expanded && (
        <div onClick={e => e.stopPropagation()}>
          {/* Cómo funciona */}
          <Section title="Cómo funciona" color={bot.color}>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {bot.how.map((h, i) => (
                <li key={i} style={{ fontSize: '0.81rem', color: 'var(--td)', lineHeight: 1.5 }}>{h}</li>
              ))}
            </ul>
          </Section>

          {/* Condiciones */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '0.75rem 0' }}>
            <CondBox label="Condición de ENTRADA" color="#4ade80" text={bot.entry} />
            <CondBox label="Condición de SALIDA"  color="#f87171" text={bot.exit} />
          </div>

          {/* Parámetros */}
          <Section title="Parámetros de configuración" color={bot.color}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {bot.params.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <code style={{ color: bot.color, background: bot.color + '11', padding: '0.1rem 0.4rem',
                    borderRadius: 3, fontFamily: 'monospace', flexShrink: 0 }}>
                    {p.name}
                  </code>
                  <span style={{ color: 'var(--td)' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Pros / Contras */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '0.75rem 0' }}>
            <div style={{ padding: '0.75rem', background: '#14532d22', borderRadius: 6, border: '1px solid #14532d44' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.4rem' }}>VENTAJAS</div>
              {bot.pros.map((p, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--td)', marginBottom: '0.25rem' }}>+ {p}</div>
              ))}
            </div>
            <div style={{ padding: '0.75rem', background: '#450a0a22', borderRadius: 6, border: '1px solid #450a0a44' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>LIMITACIONES</div>
              {bot.cons.map((c, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--td)', marginBottom: '0.25rem' }}>− {c}</div>
              ))}
            </div>
          </div>

          {/* Mejor/peor contexto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <CondBox label="Ideal para" color="#38bdf8" text={bot.best} />
            <CondBox label="Evitar cuando" color="#f59e0b" text={bot.avoid} />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color, letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function CondBox({ label, color, text }) {
  return (
    <div style={{ padding: '0.65rem 0.75rem', background: color + '0d', borderRadius: 6, border: `1px solid ${color}33` }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color, marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--td)', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

export default function BotGuide() {
  const [category, setCategory] = useState('todos');
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch]     = useState('');

  const filtered = BOTS.filter(b => {
    const catOk  = category === 'todos' || BOT_CATEGORY[b.type] === category;
    const srchOk = !search || b.label.toLowerCase().includes(search.toLowerCase())
                           || b.subtitle.toLowerCase().includes(search.toLowerCase())
                           || b.strategy.toLowerCase().includes(search.toLowerCase());
    return catOk && srchOk;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title" style={{ margin: '0 0 0.35rem' }}>Guía de Bots</h1>
        <p style={{ color: 'var(--td)', fontSize: '0.88rem', margin: 0 }}>
          {BOTS.length} estrategias disponibles — haz clic en cualquier bot para ver todos los detalles, parámetros y condiciones de operación.
        </p>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setCategory(key)}
            style={{ fontSize: '0.8rem', border: '1px solid #334155',
              background: category === key ? '#0284c7' : 'var(--su)',
              color: category === key ? 'white' : 'var(--ts)',
              fontWeight: category === key ? 700 : 400 }}>
            {label}
          </button>
        ))}
        <input
          className="form-input"
          placeholder="Buscar bot…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 180, fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
        />
      </div>

      {/* Resumen visual de los 9 bots */}
      {category === 'todos' && !search && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {BOTS.map(b => (
            <div key={b.type}
              onClick={() => setExpanded(expanded === b.type ? null : b.type)}
              style={{ padding: '0.6rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                background: expanded === b.type ? b.color + '18' : 'var(--su)',
                border: `1px solid ${expanded === b.type ? b.color : '#334155'}`,
                transition: 'all 0.15s' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: b.color, marginBottom: '0.15rem' }}>{b.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--td)' }}>{b.strategy}</div>
              <div style={{ fontSize: '0.65rem', color: RISK_COLOR[b.risk.split('-')[0]] || '#f59e0b', marginTop: '0.2rem' }}>
                Riesgo: {b.risk}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards expandibles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map(b => (
          <BotGuideCard
            key={b.type}
            bot={b}
            expanded={expanded === b.type}
            onToggle={() => setExpanded(expanded === b.type ? null : b.type)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--td)' }}>
          No hay bots que coincidan con la búsqueda.
        </div>
      )}

      {/* Nota al pie */}
      <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--su)',
        borderRadius: 8, border: '1px solid #334155', fontSize: '0.78rem', color: 'var(--td)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--tx)' }}>Modo Sandbox recomendado para empezar —</strong>{' '}
        Todos los bots funcionan en modo simulado (sin dinero real) cuando el toggle Sandbox está activado.
        Úsalo para familiarizarte con el comportamiento de cada estrategia antes de operar en real.
        Los resultados pasados no garantizan resultados futuros. El trading de criptomonedas conlleva riesgo de pérdida de capital.
      </div>
    </div>
  );
}
