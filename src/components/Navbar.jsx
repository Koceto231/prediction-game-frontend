import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { balance } = useWallet();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const username = user?.username ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  return (
    <header className="navbar">
      <Link to="/matches" className="brand-link">
        <div className="brand">PRED.TERMINAL</div>
      </Link>

      <nav className="nav-links">
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/bets">My Bets</NavLink>
        <NavLink to="/leaderboard">Board</NavLink>
        <NavLink to="/leagues">Leagues</NavLink>
        <NavLink to="/fantasy">Fantasy</NavLink>
        <NavLink to="/standings">Standings</NavLink>
        <NavLink to="/news">News</NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>

      <div className="navbar-right">
        {balance !== null && (
          <div className="wallet-badge">
            <span className="wallet-icon">€</span>
            <span className="wallet-amount">{Number(balance).toLocaleString()}</span>
          </div>
        )}

        <div className="nav-avatar-wrap" ref={menuRef}>
          <button
            className="nav-avatar"
            onClick={() => setMenuOpen(o => !o)}
            title={username}
            type="button"
          >
            {initials}
          </button>

          {menuOpen && (
            <div className="nav-avatar-menu">
              <div className="nav-avatar-menu__user">{username}</div>
              <button className="nav-avatar-menu__item" onClick={handleProfile} type="button">
                Profile
              </button>
              <div className="nav-avatar-menu__divider" />
              <button className="nav-avatar-menu__item nav-avatar-menu__item--danger" onClick={handleLogout} type="button">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
