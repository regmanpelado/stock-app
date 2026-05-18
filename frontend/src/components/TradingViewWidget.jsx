import { useEffect, useRef } from 'react';

const TF_TV  = { '1m':'1','5m':'5','15m':'15','30m':'30','1h':'60','4h':'240','1d':'D','1w':'W' };
const EX_TV  = { binance:'BINANCE', coinbase:'COINBASE', kraken:'KRAKEN', gateio:'GATEIO' };
// Kraken exposes XBT internally; TradingView uses BTC
const ALIAS  = { XBT:'BTC' };

function toTVSymbol(symbol, exchange) {
  if (!symbol) return 'BINANCE:BTCUSDT';
  const [base, quote] = symbol.split('/');
  if (!base || !quote) return 'BINANCE:BTCUSDT';
  const b = ALIAS[base]  || base;
  const q = ALIAS[quote] || quote;
  const prefix = EX_TV[(exchange || 'binance').toLowerCase()] || 'BINANCE';
  return `${prefix}:${b}${q}`;
}

export default function TradingViewWidget({
  symbol    = 'BTC/USDT',
  exchange  = 'binance',
  timeframe = '1h',
  height    = 480,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';

    const script = document.createElement('script');
    script.type  = 'text/javascript';
    script.src   = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize:            true,
      symbol:              toTVSymbol(symbol, exchange),
      interval:            TF_TV[timeframe] || '60',
      timezone:            'Europe/Madrid',
      theme:               'dark',
      style:               '1',
      locale:              'es',
      allow_symbol_change: false,
      calendar:            false,
      hide_top_toolbar:    false,
      hide_legend:         false,
      save_image:          false,
      support_host:        'https://www.tradingview.com',
    });
    el.appendChild(script);

    return () => { if (ref.current) ref.current.innerHTML = ''; };
  }, [symbol, exchange, timeframe]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
}
