import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const STATUS_LABELS = {
  Won:  { label: 'Won ✅',  cls: 'bet-status--won'  },
  Lost: { label: 'Lost ❌', cls: 'bet-status--lost' },
  Void: { label: 'Void',    cls: 'bet-status--void' },
};

const BET_TYPE_LABELS = {
  Winner:       '1/X/2',
  ExactScore:   'Exact Score',
  BTTS:         'BTTS',
  OverUnder:    'Over/Under',
  DoubleChance: 'Double Chance',
  Corners:      'Corners',
  YellowCards:  'Yellow Cards',
  Goalscorer:   'Goalscorer',
  Accumulator:  'Accumulator',
};

export default function ProfilePage() {
  const [profile, setProfile]   = useState(null);
  const [stats, setStats]       = useState(null);
  const [bets, setBets]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [balance, setBalance]   = useState(null);
  const [topping, setTopping]   = useState(false);
  const [topUpMsg, setTopUpMsg] = useState('');
  const [betFilter, setBetFilter]   = useState('All'); // All | Won | Lost
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [profileRes, statsRes, walletRes, betsRes] = await Promise.all([
          api.get('/Profile/me'),
          api.get('/Profile/stats'),
          api.get('/Wallet'),
          api.get('/Bet/me'),
        ]);
        if (!cancelled) {
          setProfile(profileRes.data);
          setStats(statsRes.data);
          setBalance(walletRes.data.balance);
          // Only completed bets (not Pending)
          setBets((betsRes.data ?? []).filter(b => b.status !== 'Pending'));
        }
      } catch (err) {
        if (!cancelled)
          setError(err?.response?.data?.message || 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return (
    <div className="profile-page">
      <div className="shell-card profile-state-card"><h2>Loading profile...</h2></div>
    </div>
  );

  if (error) return (
    <div className="profile-page">
      <div className="shell-card profile-state-card">
        <h2>Profile</h2>
        <div className="alert alert-error">{error}</div>
      </div>
    </div>
  );

  const username    = profile?.username || 'User';
  const email       = profile?.email    || '-';
  const role        = profile?.role     || 'User';
  const firstLetter = username.charAt(0).toUpperCase();

  // Bet history stats
  const wonBets  = bets.filter(b => b.status === 'Won');
  const lostBets = bets.filter(b => b.status === 'Lost');
  const totalWon    = wonBets.reduce((s, b) => s + (b.actualPayout ?? 0), 0);
  const totalStaked = bets.reduce((s, b) => s + b.amount, 0);

  const filteredBets = betFilter === 'Won'  ? wonBets
                     : betFilter === 'Lost' ? lostBets
                     : bets;

  return (
    <div className="profile-page">

      {/* Header */}
      <div className="shell-card profile-header-card">
        <div className="profile-avatar-big">{firstLetter}</div>
        <div className="profile-header-content">
          <div className="profile-header-row">
            <h1>{username}</h1>
            <span className="profile-role-pill">{role}</span>
          </div>
          <p className="profile-email-text">{email}</p>
          <p className="profile-muted-text">Your BPFL account and prediction stats.</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="shell-card profile-wallet-card">
        <div className="profile-wallet-left">
          <span className="wallet-icon-big">€</span>
          <div>
            <h3>Demo Wallet</h3>
          </div>
        </div>
        <div className="profile-wallet-right">
          <span className="wallet-balance-big">{balance !== null ? Number(balance).toLocaleString() : '—'} coins</span>
          <button className="primary-button" disabled={topping || (balance !== null && Number(balance) > 0)}
            onClick={async () => {
              setTopping(true); setTopUpMsg('');
              try {
                const res = await api.post('/Wallet/topup');
                setBalance(res.data.balance);
                setTopUpMsg('+1,000 coins added!');
              } catch (err) {
                setTopUpMsg(err?.response?.data?.message || 'Top up failed.');
              } finally { setTopping(false); }
            }}>
            {topping ? 'Adding...' : '+ Top Up 1,000'}
          </button>
          {topUpMsg && <span className="wallet-topup-msg">{topUpMsg}</span>}
        </div>
      </div>

      {/* Prediction stats */}
      <div className="profile-stats-grid">
        <div className="shell-card profile-stat-card">
          <span>Total Predictions</span>
          <strong>{stats?.totalPredictions ?? 0}</strong>
        </div>
        <div className="shell-card profile-stat-card">
          <span>Total Points</span>
          <strong>{stats?.totalPoints ?? 0}</strong>
        </div>
        <div className="shell-card profile-stat-card">
          <span>Correct Outcomes</span>
          <strong>{stats?.correctOutcomeCount ?? 0}</strong>
        </div>
        <div className="shell-card profile-stat-card">
          <span>Accuracy</span>
          <strong>{stats?.accuracyPercent ?? 0}%</strong>
        </div>
      </div>

      {/* Account info + performance */}
      <div className="profile-bottom-layout">
        <div className="shell-card profile-info-card">
          <h3>Account Info</h3>
          <div className="profile-info-item"><span>Username</span><strong>{username}</strong></div>
          <div className="profile-info-item"><span>Email</span><strong>{email}</strong></div>
          <div className="profile-info-item"><span>Role</span><strong>{role}</strong></div>
        </div>
        <div className="shell-card profile-summary-card">
          <h3>Performance Summary</h3>
          <p>You have made <strong>{stats?.totalPredictions ?? 0}</strong> predictions and collected <strong>{stats?.totalPoints ?? 0}</strong> points.</p>
          <p>Your current accuracy is <strong>{stats?.accuracyPercent ?? 0}%</strong>, with <strong>{stats?.correctOutcomeCount ?? 0}</strong> correct outcomes.</p>
        </div>
      </div>

      {/* Bet history */}
      <div className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Bet History</h2>
            <p>All your completed bets.</p>
          </div>
        </div>

        {/* Summary row */}
        {bets.length > 0 && (
          <div className="bets-summary">
            <div className="shell-card profile-stat-card">
              <span>Total Bets</span>
              <strong>{bets.length}</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Won</span>
              <strong style={{ color: 'var(--accent)' }}>{wonBets.length}</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Lost</span>
              <strong style={{ color: '#ff6b6b' }}>{lostBets.length}</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Staked</span>
              <strong>{Number(totalStaked).toLocaleString()} €</strong>
            </div>
            <div className="shell-card profile-stat-card">
              <span>Total Won</span>
              <strong style={{ color: 'var(--accent)' }}>{Number(totalWon).toFixed(2)} €</strong>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {bets.length > 0 && (
          <div className="pos-tabs" style={{ marginBottom: 16 }}>
            {['All', 'Won', 'Lost'].map(f => (
              <button key={f} type="button"
                className={`pos-tab ${betFilter === f ? 'pos-tab--active' : ''}`}
                onClick={() => setBetFilter(f)}>
                {f} {f === 'All' ? `(${bets.length})` : f === 'Won' ? `(${wonBets.length})` : `(${lostBets.length})`}
              </button>
            ))}
          </div>
        )}

        {bets.length === 0 && (
          <div className="empty-box">No completed bets yet.</div>
        )}

        {filteredBets.length === 0 && bets.length > 0 && (
          <div className="empty-box">No {betFilter.toLowerCase()} bets.</div>
        )}

        <div className="bets-list">
          {filteredBets.map(bet => {
            const status     = STATUS_LABELS[bet.status] ?? { label: bet.status, cls: '' };
            const typeLabel  = BET_TYPE_LABELS[bet.betType] ?? bet.betType;
            const isWon      = bet.status === 'Won';
            const maxPts     = bet.maxPoints ?? 0;
            const isAccum    = bet.betType === 'Accumulator';
            const legs       = bet.accumulatorLegs ?? [];
            const isExpanded = expandedId === bet.id;

            const displayLegs = isAccum ? legs : [{
              description: bet.betDescription,
              betType:     bet.betType,
              odds:        bet.oddsAtBetTime,
            }];

            return (
              <div key={bet.id}
                className="bet-card shell-card bet-card--expandable"
                onClick={() => setExpandedId(isExpanded ? null : bet.id)}>

                <div className="bet-card__header">
                  <div>
                    <span className="bet-card__fixture">{bet.homeTeam} vs {bet.awayTeam}</span>
                    <span className="bet-card__type-badge">{typeLabel}</span>
                    {isAccum && <span className="bet-card__type-badge" style={{ marginLeft: 4 }}>{legs.length} legs</span>}
                  </div>
                  <span className={`bet-status ${status.cls}`}>{status.label}</span>
                  <span className={`bet-card__chevron ${isExpanded ? 'bet-card__chevron--open' : ''}`}>▼</span>
                </div>

                <div className="bet-card__date">
                  {new Date(bet.matchDate).toLocaleDateString()} · Placed {new Date(bet.createdAt).toLocaleDateString()}
                </div>

                <div className="bet-card__details">
                  <div className="bet-card__pick">Pick: <strong>{bet.betDescription}</strong></div>
                  <div>Odds: <strong>{Number(bet.oddsAtBetTime).toFixed(2)}</strong></div>
                  <div>Stake: <strong>{Number(bet.amount).toLocaleString()} €</strong></div>
                  <div>
                    {isWon
                      ? <>Payout: <strong className="text-won">{Number(bet.actualPayout).toFixed(2)} €</strong></>
                      : <>Potential: <strong>{Number(bet.potentialPayout).toFixed(2)} €</strong></>
                    }
                  </div>
                </div>

                {isExpanded && (
                  <div className="bet-card__legs">
                    {displayLegs.map((leg, i) => (
                      <div key={i} className="bet-card__leg">
                        <span className="bet-card__leg-desc">{leg.description}</span>
                        <span className="bet-card__leg-type">{BET_TYPE_LABELS[leg.betType] ?? leg.betType}</span>
                        <span className="bet-card__leg-odds">× {Number(leg.odds).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {maxPts > 0 && (
                  <div className="bet-card__points">
                    <span className="bet-card__points-label">POINTS</span>
                    <span className="bet-card__points-value">
                      {isWon
                        ? <strong style={{ color: 'var(--accent)' }}>+{maxPts} pts earned</strong>
                        : <span className="muted-text">0 / {maxPts} pts</span>
                      }
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
