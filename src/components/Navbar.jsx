import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();

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
        {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
      </nav>

      <div className="nav-user">
        <div>
          <div className="user-name">{user.username ?? 'Guest'}</div>
          <div className="user-role">{user?.role ?? 'Visitor'}</div>
        </div>
        <button className="ghost-button" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
