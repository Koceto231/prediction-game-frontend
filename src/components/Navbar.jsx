import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import {
  Zap,
  ClipboardList,
  Crown,
  Trophy,
  Menu,
  Globe,
  BarChart2,
  CheckCircle,
  Newspaper,
  Settings,
  User,
  LogOut,
  Radio,
} from 'lucide-react';

const PRIMARY_TABS = [
  { to: '/matches',     Icon: Zap,           label: 'Matches'  },
  { to: '/live',        Icon: Radio,          label: 'Live'     },
  { to: '/bets',        Icon: ClipboardList,  label: 'My Bets'  },
  { to: '/fantasy',     Icon: Crown,          label: 'Fantasy'  },
  { to: '/leaderboard', Icon: Trophy,         label: 'Board'    },
];

const MORE_ITEMS = [
  { to: '/leagues',   Icon: Globe,        label: 'Leagues'   },
  { to: '/standings', Icon: BarChart2,    label: 'Standings' },
  { to: '/results',   Icon: CheckCircle,  label: 'Results'   },
  { to: '/news',      Icon: Newspaper,    label: 'News'      },
];

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { balance } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const handleProfile = () => { setMenuOpen(false); setMoreOpen(false); navigate('/profile'); };
  const handleLogout  = () => { setMenuOpen(false); setMoreOpen(false); logout(); };

  const moreActive = MORE_ITEMS.some(i => location.pathname.startsWith(i.to))
    || location.pathname.startsWith('/profile')
    || (isAdmin && location.pathname.startsWith('/admin'));

  return (
    <>
      {/* ── Top bar ── */}
      <header className="navbar">
        <Link to="/matches" className="brand-link">
          <div className="brand">BETWIN</div>
        </Link>

        <nav className="nav-links">
          <NavLink to="/matches">Matches</NavLink>
          <NavLink to="/live">Live</NavLink>
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
                <button className="nav-avatar-menu__item" onClick={handleProfile} type="button">Profile</button>
                <div className="nav-avatar-menu__divider" />
                <button className="nav-avatar-menu__item nav-avatar-menu__item--danger" onClick={handleLogout} type="button">Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile balance bar ── */}
      {balance !== null && (
        <div className="mobile-balance-bar">
          € {Number(balance).toLocaleString()}
        </div>
      )}

      {/* ── Bottom tab bar ── */}
      <nav className="bottom-tab-bar" aria-label="Main navigation">
        {PRIMARY_TABS.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'bottom-tab' + (isActive ? ' bottom-tab--active' : '')
            }
          >
            <Icon size={20} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={'bottom-tab' + (moreActive ? ' bottom-tab--active' : '')}
          onClick={() => setMoreOpen(o => !o)}
          aria-expanded={moreOpen}
        >
          <Menu size={20} strokeWidth={1.75} />
          <span>More</span>
        </button>
      </nav>

      {/* ── More overlay ── */}
      {moreOpen && (
        <div className="bottom-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="bottom-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-more-sheet__title">More</div>

            {MORE_ITEMS.map(({ to, Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  'bottom-more-item' + (isActive ? ' active' : '')
                }
                onClick={() => setMoreOpen(false)}
              >
                <span className="bottom-more-item__icon"><Icon size={18} strokeWidth={1.75} /></span>
                {label}
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
                <span className="bottom-more-item__icon"><Settings size={18} strokeWidth={1.75} /></span>
                Admin
              </NavLink>
            )}

            <div className="bottom-more-sheet__divider" />
            <div className="bottom-more-sheet__title">Account</div>

            <button type="button" className="bottom-more-item" onClick={handleProfile}>
              <span className="bottom-more-item__icon"><User size={18} strokeWidth={1.75} /></span>
              Profile
            </button>

            <button type="button" className="bottom-more-item bottom-more-item--danger" onClick={handleLogout}>
              <span className="bottom-more-item__icon"><LogOut size={18} strokeWidth={1.75} /></span>
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
