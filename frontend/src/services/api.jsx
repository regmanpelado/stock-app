import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const is401   = error.response?.status === 401;
    const isLogin = window.location.pathname.includes('/login');
    const url     = error.config?.url || '';
    const isAuth  = url.includes('/auth/login') || url.includes('/auth/2fa/verify')
                    || url.includes('/auth/register');
    if (is401 && !isLogin && !isAuth) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Mercados ──────────────────────────────────────────────────────────────────
export const marketApi = {
  getIndices:   ()                              => api.get('/markets/indices').then(r => r.data),
  getCurrencies: ()                             => api.get('/markets/currencies').then(r => r.data),
  getSectors:   ()                              => api.get('/markets/sectors').then(r => r.data),
  getPopular:   (exchange)                      => api.get(`/markets/popular/${exchange}`).then(r => r.data),
  getQuote:     (symbol, exchange = 'NYSE')     => api.get(`/markets/quote/${symbol}`, { params: { exchange } }).then(r => r.data),
  getHistory:   (symbol, exchange = 'NYSE', period = '6mo', interval = '1d') =>
    api.get(`/markets/history/${symbol}`, { params: { exchange, period, interval } }).then(r => r.data),
  search:       (q)                             => api.get('/markets/search', { params: { q } }).then(r => r.data),
  getExchanges: ()                              => api.get('/markets/exchanges').then(r => r.data),
};

// ── Portfolio ─────────────────────────────────────────────────────────────────
export const portfolioApi = {
  get:            ()                                          => api.get('/portfolio/').then(r => r.data),
  addPosition:    (data)                                      => api.post('/portfolio/positions', data).then(r => r.data),
  updatePosition: (id, data)                                  => api.put(`/portfolio/positions/${id}`, data).then(r => r.data),
  deletePosition: (id)                                        => api.delete(`/portfolio/positions/${id}`).then(r => r.data),
  getAlpaca:      ()                                          => api.get('/portfolio/alpaca').then(r => r.data),
  placeOrder:     (symbol, qty, side)                         => api.post('/portfolio/alpaca/order', null, { params: { symbol, qty, side } }).then(r => r.data),
};

// ── Bolsas (info + horarios) ──────────────────────────────────────────────────
export const exchangeApi = {
  listExchanges: () => api.get('/exchanges/').then(r => r.data),
  getAllStatus:  () => api.get('/exchanges/status/all').then(r => r.data),
  getStatus:    (exchange) => api.get(`/exchanges/${exchange}/status`).then(r => r.data),
};

// ── Señales técnicas ──────────────────────────────────────────────────────────
export const signalsApi = {
  getScreener: (exchange, limit = 10) =>
    api.get(`/signals/screener/${exchange}`, { params: { limit } }).then(r => r.data),
  getSymbol:   (exchange, symbol) =>
    api.get(`/signals/${exchange}/${encodeURIComponent(symbol)}`).then(r => r.data),
};

// ── Bots ──────────────────────────────────────────────────────────────────────
export const botsApi = {
  advisor: (message) => api.post('/bots/advisor', { message }).then(r => r.data),
  list:    ()        => api.get('/bots/').then(r => r.data),
  get:     (id)      => api.get(`/bots/${id}`).then(r => r.data),
  create:  (payload) => api.post('/bots/', payload).then(r => r.data),
  start:   (id)      => api.post(`/bots/${id}/start`).then(r => r.data),
  pause:   (id)      => api.post(`/bots/${id}/pause`).then(r => r.data),
  stop:    (id)      => api.post(`/bots/${id}/stop`).then(r => r.data),
  delete:  (id)      => api.delete(`/bots/${id}`).then(r => r.data),
};

// ── Órdenes ───────────────────────────────────────────────────────────────────
export const orderApi = {
  placeOrder: (symbol, qty, side) => api.post('/orders/', { symbol, qty, side }).then(r => r.data),
  listOrders: ()                   => api.get('/orders/').then(r => r.data),
};

// ── Noticias ──────────────────────────────────────────────────────────────────
export const newsApi = {
  getNews:    (limit = 60) => api.get('/news/', { params: { limit } }).then(r => r.data),
  getSources: ()           => api.get('/news/sources').then(r => r.data),
};

// ── Suscripciones ─────────────────────────────────────────────────────────────
export const subscriptionsApi = {
  getPlanes:      ()      => api.get('/subscriptions/planes').then(r => r.data),
  getUsuario:     ()      => api.get('/subscriptions/usuario').then(r => r.data),
  cambiarPlan:    (plan)  => api.post('/subscriptions/usuario/plan', { plan }).then(r => r.data),
  getPermisos:    ()      => api.get('/subscriptions/permisos').then(r => r.data),
  createCheckout: (plan)  => api.post('/subscriptions/checkout', { plan }).then(r => r.data),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  getMetricas:   ()         => api.get('/admin/metricas').then(r => r.data),
  getUsers:      ()         => api.get('/admin/users').then(r => r.data),
  getUser:       (id)       => api.get(`/admin/users/${id}`).then(r => r.data),
  updatePlan:    (id, plan) => api.put(`/admin/users/${id}/plan`, { plan }).then(r => r.data),
  toggleStatus:  (id)       => api.put(`/admin/users/${id}/status`).then(r => r.data),
  toggleAdmin:   (id)       => api.put(`/admin/users/${id}/admin`).then(r => r.data),
  deleteUser:    (id)       => api.delete(`/admin/users/${id}`).then(r => r.data),
  resetPassword: (id)       => api.post(`/admin/users/${id}/reset-password`).then(r => r.data),
  verifyEmail:   (id)       => api.post(`/admin/users/${id}/verify-email`).then(r => r.data),
  getAuditLog:   (params)   => api.get('/admin/audit-log', { params }).then(r => r.data),
  getStripeMetrics: ()      => api.get('/admin/stripe-metrics').then(r => r.data),
  get2faStatus:  ()         => api.get('/admin/2fa/status').then(r => r.data),
  get2faSetup:   ()         => api.get('/admin/2fa/setup').then(r => r.data),
  enable2fa:     (code)     => api.post('/admin/2fa/enable', { code }).then(r => r.data),
  disable2fa:    (code)     => api.post('/admin/2fa/disable', { code }).then(r => r.data),
  regenerateBackupCodes: (code) => api.post('/admin/2fa/backup-codes/regenerate', { code }).then(r => r.data),
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register:       (nombre, email, password) =>
    api.post('/auth/register', { nombre, email, password }).then(r => r.data),
  login:          (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  verifyEmail:    (token) =>
    api.get('/auth/verify-email', { params: { token } }).then(r => r.data),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword:  (token, password) =>
    api.post('/auth/reset-password', { token, password }).then(r => r.data),
  me:             () => api.get('/auth/me').then(r => r.data),
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }).then(r => r.data),
  verify2fa:      (totp_token, code) =>
    api.post('/auth/2fa/verify', { totp_token, code }).then(r => r.data),
  refresh:        () => api.post('/auth/refresh').then(r => r.data),
};

// ── Backtest ──────────────────────────────────────────────────────────────────
export const backtestApi = {
  run: (payload) => api.post('/backtest/run', payload).then(r => r.data),
};

// ── Tipo de cambio ────────────────────────────────────────────────────────────
export const currencyApi = {
  getEURUSD: () => api.get('/currency/eurusd').then(r => r.data),
};
