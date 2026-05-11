import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';

const PRIMARY_TABS = [
  { to: '/matches',     icon: '⚽', label: 'Matches'  },
  { to: '/bets',        icon: '📋', label: 'My Bets'  },
  { to: '/fantasy',     icon: '👑', label: 'Fantasy'  },
  { to: '/leaderboard', icon: '🏆', label: 'Board'    },
];

const MORE_ITEMS = [
  { to: '/leagues',    icon: '🌍', label: 'Leagues'   },
  { to: '/standings',  icon: '📊', label: 'Standings' },
  { to: '/results',    icon: '✅', label: 'Results'   },
  { to: '/news',       icon: '📰', label: 'News'      },
];

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { balance } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [moreOpen,    setMoreOpen]    = useState(false);
  const menuRef = useRef(null);

  const username = user?.username ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close more-sheet on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const handleProfile = () => { setMenuOpen(false); navigate('/profile'); };
  const handleLogout  = () => { setMenuOpen(false); logout(); };

  // Is current path in the "More" group?
  const moreActive = MORE_ITEMS.some(i => location.pathname.startsWith(i.to))
    || (isAdmin && location.pathname.startsWith('/admin'));

  return (
    <>
      {/* ── Top bar ── */}
      <header className="navbar">
        <Link to="/matches" className="brand-link">
          <div className="brand">BETWIN</div>
        </Link>

        {/* Desktop nav — hidden on mobile via CSS */}
        <nav className="nav-links">
          <NavLink to="/matches">Matches</NavLink>
          <NavLink to="/bets">My Bets</NavLink>
          <NavLink to="/leaderboard">Board</NavLink>
          <NavLink to="/leagues">Leagues</NavLink>
          <NavLink to="/fantasy">Fantasy</NavLink>
          <NavLink to="/standings">Standings</NavLink>
          <NavLink to="/results">Results</NavLink>
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

      {/* ── Bottom tab bar (mobile only — shown via CSS) ── */}
      <nav className="bottom-tab-bar" aria-label="Main navigation">
        {PRIMARY_TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              'bottom-tab' + (isActive ? ' bottom-tab--active' : '')
            }
          >
            <span className="bottom-tab__icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}

        {/* More button */}
        <button
          type="button"
          className={'bottom-tab' + (moreActive ? ' bottom-tab--active' : '')}
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
        >
          <span className="bottom-tab__icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* ── More overlay ── */}
      {moreOpen && (
        <div
          className="bottom-more-overlay"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="bottom-more-sheet"
            onClick={e => e.stopPropagation()}
          >
            <div className="bottom-more-sheet__title">More</div>

            {MORE_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  'bottom-more-item' + (isActive ? ' active' : '')
                }
                onClick={() => setMoreOpen(false)}
              >
                <span className="bottom-more-item__icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  'bottom-more-item' + (isActive ? ' active' : '')
                }
                onClick={() => setMoreOpen(false)}
              >
                <span className="bottom-more-item__icon">⚙️</span>
                Admin
              </NavLink>
            )}
          </div>
        </div>
      )}
    </>
  );
}
