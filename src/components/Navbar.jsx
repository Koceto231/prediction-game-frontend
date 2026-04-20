import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { balance } = useWallet();

  const username = user?.username ?? '';

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
        <NavLink to="/fantasy">Fantasy</NavLink>
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
