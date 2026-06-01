import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';

// Kill-switch — QuickBet mode is retired but its localStorage flag may
// still be set in users' browsers from before. Clear it on every app
// boot so a cached old client bundle can't pick it up and short-circuit
// odd clicks into instant bet placement.
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('bpfl:quickbet:enabled');
    localStorage.removeItem('bpfl:quickbet:stake');
  } catch { /* ignore — Safari private mode */ }
  window.bpflQuickBet = { enabled: false, stake: 0 };
}
import OddsTicker from './components/OddsTicker';
import BetSlipPanel from './components/BetSlipPanel';
import { useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import MatchesPage from './pages/MatchesPage';
import LivePage from './pages/LivePage';
import PredictionsPage from './pages/PredictionsPage';
import LeaguesPage from './pages/LeaguesPage';
import LeaguePage from './pages/LeaguePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import BetsPage from './pages/BetsPage';
import StandingsPage from './pages/StandingsPage';
import ResultsPage from './pages/ResultsPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/matches" replace />;
  }

  return children;
}

function AppLayout() {
  return (
    <div className="app-shell">
      <div className="pitch-overlay" />
      <Navbar />
      <div className="container">
        <main className="main-content" style={{ marginTop: 0 }}>
          <Routes>
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/leagues/:leagueId" element={<LeaguePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/bets" element={<BetsPage />} />
            <Route path="/standings" element={<StandingsPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/matches" replace />} />
          </Routes>
        </main>
      </div>
      <OddsTicker />
      <BetSlipPanel />
    </div>
  );

}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/matches" replace /> : <LoginPage />}
      />
      {/* Admin-issued invitation links land here — same component handles
          both modes; the LoginPage swaps to register when the URL carries
          an invite token. */}
      <Route path="/register" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}