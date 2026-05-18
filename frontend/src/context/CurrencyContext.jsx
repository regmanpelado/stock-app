import React, { createContext, useContext, useState, useEffect } from 'react';
import { currencyApi } from '../services/api.jsx';

const CurrencyContext = createContext({ eurUsd: 1.09, usdEur: 0.917 });

export function CurrencyProvider({ children }) {
  const [rates, setRates] = useState({ eurUsd: 1.09, usdEur: 0.917 });

  const fetchRate = async () => {
    try {
      const r = await currencyApi.getEURUSD();
      setRates({ eurUsd: r.eur_usd, usdEur: r.usd_eur });
    } catch { /* mantiene el valor anterior */ }
  };

  useEffect(() => {
    fetchRate();
    const id = setInterval(fetchRate, 300_000); // refresca cada 5 min
    return () => clearInterval(id);
  }, []);

  return (
    <CurrencyContext.Provider value={rates}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
