# Stock App

Plataforma SaaS de trading automatizado para bolsas de todo el mundo.

## Stack
- **Backend**: FastAPI + PostgreSQL + Alembic
- **Frontend**: React + Vite
- **Trading**: Alpaca (paper + live, NYSE/NASDAQ)
- **Datos**: yfinance (bolsas globales) + Twelve Data (tiempo real)
- **Deploy**: Railway

## Bolsas cubiertas
NYSE, NASDAQ, LSE, Euronext, Xetra, TSE, HKEX, BSE, BME

## Variables de entorno necesarias
- `DATABASE_URL` — PostgreSQL (Railway)
- `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` — alpaca.markets
- `ALPACA_PAPER` — true (paper trading) / false (live)
- `TWELVE_DATA_API_KEY` — twelvedata.com
- `JWT_SECRET` — secreto para tokens
- `ADMIN_EMAIL` — email del administrador
