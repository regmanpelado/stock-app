import React, { useState, useEffect, Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: '2rem', color: '#f87171', fontFamily: 'monospace', background: '#0f172a', minHeight: '100vh' }}>
        <h2>Error al cargar la aplicación:</h2>
        <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
      </div>
    );
    return this.props.children;
  }
}
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Dashboard     from './pages/Dashboard';
import Markets       from './pages/Markets';
import Portfolio     from './pages/Portfolio';
import Signals       from './pages/Signals';
import Bots          from './pages/Bots';
import Pricing       from './pages/Pricing';
import Backtest      from './pages/Backtest';
import Admin         from './pages/Admin';
import News          from './pages/News';
import Login         from './pages/Login';
import Register      from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import VerifyEmail    from './pages/VerifyEmail';
import Profile       from './pages/Profile';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel  from './pages/PaymentCancel';
import PrivateRoute    from './components/PrivateRoute';
import InstallBanner  from './components/InstallBanner';
import SessionManager from './components/SessionManager';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth }   from './context/AuthContext';
import './App.css';

const nl = ({ isActive }) => isActive ? 'nav-link active' : 'nav-link';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggle}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

function NavbarAuth() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return (
      <div className="navbar-auth">
        <NavLink to="/login"    className="btn btn-primary" style={{ padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
          Entrar
        </NavLink>
        <NavLink to="/register" className="btn" style={{ padding: '0.35rem 0.9rem', fontSize: '0.82rem', background: 'transparent', border: '1px solid var(--bd)', color: 'var(--ts)' }}>
          Registro
        </NavLink>
      </div>
    );
  }

  return (
    <div className="navbar-auth">
      <NavLink to="/profile" className="navbar-user" title="Mi perfil" style={{ textDecoration: 'none', cursor: 'pointer' }}>
        {user?.nombre || user?.email}
      </NavLink>
      <button className="btn btn-danger" onClick={handleLogout}
        style={{ padding: '0.35rem 0.9rem', fontSize: '0.82rem' }}>
        Salir
      </button>
    </div>
  );
}

const NAV_LINKS = [
  { to: '/',          label: 'Dashboard',  end: true },
  { to: '/markets',   label: 'Mercados' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/signals',   label: 'Señales' },
  { to: '/bots',      label: 'Bots' },
  { to: '/news',      label: 'Noticias' },
  { to: '/backtest',  label: 'Backtest' },
  { to: '/pricing',   label: 'Planes' },
  { to: '/admin',     label: 'Admin', adminOnly: true },
];

function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Cierra el menú al cambiar de página
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!e.target.closest('.navbar')) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">Stock App</div>

        {/* Links horizontales — desktop */}
        {isAuthenticated && (
          <div className="navbar-links">
            {NAV_LINKS.filter(l => !l.adminOnly || user?.is_admin).map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={nl}>{label}</NavLink>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <ThemeToggle />
          <NavbarAuth />
          {/* Hamburger — mobile */}
          {isAuthenticated && (
            <button
              className={`hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menú"
            >
              <span /><span /><span />
            </button>
          )}
        </div>

        {/* Dropdown — mobile */}
        {isAuthenticated && (
          <div className={`nav-dropdown${menuOpen ? ' open' : ''}`}>
            {NAV_LINKS.filter(l => !l.adminOnly || user?.is_admin).map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={nl}>{label}</NavLink>
            ))}
          </div>
        )}
      </nav>
      <InstallBanner />
      <SessionManager />
      <main className="main-content">
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/verify-email"    element={<VerifyEmail />} />

          {/* Rutas protegidas */}
          <Route path="/"          element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/markets"   element={<PrivateRoute><Markets /></PrivateRoute>} />
          <Route path="/signals"   element={<PrivateRoute><Signals /></PrivateRoute>} />
          <Route path="/bots"      element={<PrivateRoute><Bots /></PrivateRoute>} />
          <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
          <Route path="/news"      element={<PrivateRoute><News /></PrivateRoute>} />
          <Route path="/backtest"  element={<PrivateRoute><Backtest /></PrivateRoute>} />
          <Route path="/pricing"   element={<PrivateRoute><Pricing /></PrivateRoute>} />
          <Route path="/admin"           element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel"  element={<PaymentCancel />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppLayout />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
