import { NavLink, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/apiClient';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const [balance, setBalance] = useState(null);

  const username = user?.username ?? '';

  useEffect(() => {
    if (!user) return;
    api.get('/Wallet').then(res => setBalance(res.data.balance)).catch(() => {});
  }, [user]);

  return (
    <header className="navbar shell-card">
      <Link to="/matches" className="brand-link">
        <div className="brand">Match Predictor</div>
        <div className="brand-subtitle">Football prediction game</div>
      </Link>

      <nav className="nav-links">
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/predictions">My Predictions</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/leagues">Leagues</NavLink>
        <NavLink to="/bets">My Bets</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
      </nav>

      <div className="navbar-right">
        {balance !== null && (
          <div className="wallet-badge">
            <span className="wallet-icon">🪙</span>
            <span className="wallet-amount">{Number(balance).toLocaleString()}</span>
          </div>
        )}
        <button className="ghost-button" onClick={logout} type="button">
          Logout
        </button>
      </div>
    </header>
  );
}
