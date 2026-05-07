import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import OddsTicker from './components/OddsTicker';
import { useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LoginPage from './pages/LoginPage';
import MatchesPage from './pages/MatchesPage';
import PredictionsPage from './pages/PredictionsPage';
import LeaguesPage from './pages/LeaguesPage';
import LeaguePage from './pages/LeaguePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import BetsPage from './pages/BetsPage';
import FantasyPage from './pages/FantasyPage';
import FantasyDraftPage from './pages/FantasyDraftPage';
import FantasyLeaderboardPage from './pages/FantasyLeaderboardPage';
import NewsPage from './pages/NewsPage';

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
        <main className="main-content" style={{ marginTop: 20 }}>
          <Routes>
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/leagues/:leagueId" element={<LeaguePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/bets" element={<BetsPage />} />
            <Route path="/fantasy" element={<FantasyPage />} />
            <Route path="/fantasy/draft" element={<FantasyDraftPage />} />
            <Route path="/fantasy/leaderboard" element={<FantasyLeaderboardPage />} />
            <Route path="/news" element={<NewsPage />} />
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