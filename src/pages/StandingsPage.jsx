import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const LEAGUE_ORDER = ['BGL', 'PL', 'BL1', 'SA', 'PD'];

const LEAGUE_META = {
  BGL: { label: '🇧🇬 BGL', full: 'Bulgarian Premier League' },
  PL:  { label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 PL',  full: 'Premier League' },
  BL1: { label: '🇩🇪 BL',  full: 'Bundesliga' },
  SA:  { label: '🇮🇹 SA',  full: 'Serie A' },
  PD:  { label: '🇪🇸 PD',  full: 'La Liga' },
};

const FORM_COLOR = { W: 'var(--green, #22c55e)', D: 'var(--text-muted)', L: '#ef4444' };

function FormBadge({ char }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 18, height: 18,
      lineHeight: '18px',
      fontSize: '0.6rem',
      fontWeight: 700,
      textAlign: 'center',
      borderRadius: 3,
      background: FORM_COLOR[char] ?? 'var(--border-soft)',
      color: '#fff',
      marginLeft: 2,
    }}>
      {char}
    </span>
  );
}

export default function StandingsPage() {
  const [leagues, setLeagues] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/Standings');
        const data = Array.isArray(res.data) ? res.data : [];
        setLeagues(data);
        if (data.length > 0) setActiveTab(data[0].leagueCode);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load standings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const active = leagues.find(l => l.leagueCode === activeTab);

  return (
    <div className="shell-card panel">
      <div className="section-head">
        <div>
          <h2>🏟 League Standings</h2>
          <p>{active ? LEAGUE_META[activeTab]?.full ?? activeTab : 'Select a league'}</p>
        </div>
      </div>

      {/* Tabs */}
      {!loading && !error && leagues.length > 0 && (
        <div className="fantasy-view-toggle" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          {LEAGUE_ORDER.filter(code => leagues.some(l => l.leagueCode === code)).map(code => (
            <button
              key={code}
              type="button"
              className={`fantasy-view-btn${activeTab === code ? ' fantasy-view-btn--active' : ''}`}
              onClick={() => setActiveTab(code)}
            >
              {LEAGUE_META[code]?.label ?? code}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="empty-box">Loading standings...</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {!loading && !error && leagues.length === 0 && (
        <div className="empty-box">No finished matches yet.</div>
      )}

      {!loading && !error && active && (
        <div className="standings-table">
          {/* Header */}
          <div className="standings-head">
            <span className="st-pos">#</span>
            <span className="st-club">Club</span>
            <span className="st-num">MP</span>
            <span className="st-num">W</span>
            <span className="st-num">D</span>
            <span className="st-num">L</span>
            <span className="st-num">GF</span>
            <span className="st-num">GA</span>
            <span className="st-num st-gd">GD</span>
            <span className="st-num st-pts">Pts</span>
            <span className="st-form">Form</span>
          </div>

          {active.table.map(row => (
            <div
              key={row.teamId}
              className={`standings-row${row.position <= 4 ? ' standings-row--cl' : row.position <= 6 ? ' standings-row--el' : ''}`}
            >
              <span className="st-pos">{row.position}</span>
              <span className="st-club">{row.teamName}</span>
              <span className="st-num">{row.played}</span>
              <span className="st-num">{row.won}</span>
              <span className="st-num">{row.drawn}</span>
              <span className="st-num">{row.lost}</span>
              <span className="st-num">{row.goalsFor}</span>
              <span className="st-num">{row.goalsAgainst}</span>
              <span className="st-num st-gd">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
              <span className="st-num st-pts">{row.points}</span>
              <span className="st-form">
                {row.form.split('').map((c, i) => <FormBadge key={i} char={c} />)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
