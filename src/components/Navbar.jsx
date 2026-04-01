import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();

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
        <NavLink to="/profile">Profile</NavLink>
        {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
      </nav>

     

        <button className="ghost-button" onClick={logout} type="button">
          Logout
        </button>
      
    </header>
  );
}