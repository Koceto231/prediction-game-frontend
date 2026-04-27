import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { balance } = useWallet();

  const username = user?.username ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="navbar">
      <Link to="/matches" className="brand-link">
        <div className="brand">Match Predictor</div>
      </Link>

      <nav className="nav-links">
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/bets">My Bets</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/leagues">Leagues</NavLink>
        <NavLink to="/fantasy">Fantasy</NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>

      <div className="navbar-right">
        {balance !== null && (
          <div className="wallet-badge">
            <span className="wallet-icon">🪙</span>
            <span className="wallet-amount">{Number(balance).toLocaleString()}</span>
          </div>
        )}
        <button
          className="nav-avatar"
          onClick={logout}
          title={`Logout (${username})`}
          type="button"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
