import useLiveMomentum from '../hooks/useLiveMomentum';

/**
 * Live momentum / pressure visualisation, approximated from aggregate stats
 * (see useLiveMomentum). Two parts:
 *   • a split bar — gold fill grows toward the side currently dominating
 *   • a trend sparkline — the smoothed momentum over the last ~40 samples,
 *     so you can see swings the way a real momentum graph shows them
 *
 * It deliberately reads as an INDICATOR, not a literal ball position — we
 * don't have positional data. Returns null until there's something to show.
 */
export default function LiveMomentum({ match }) {
  const { value, history } = useLiveMomentum(match);
  if (!match?.liveStats || history.length < 2) return null;

  const homePct = (value + 100) / 2;             // 0..100 share for home
  const lead    = value > 6 ? 'home' : value < -6 ? 'away' : 'even';

  // Sparkline geometry — map history (-100..100) onto a 0..1 viewBox
  const W = 100, H = 28, mid = H / 2;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = mid - (v / 100) * (mid - 2);       // +value → up (home)
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="gv-momentum">
      <div className="gv-momentum__head">
        <span className={`gv-momentum__team${lead === 'home' ? ' is-lead' : ''}`}>{match.homeTeamName}</span>
        <span className="gv-momentum__label">MOMENTUM</span>
        <span className={`gv-momentum__team${lead === 'away' ? ' is-lead' : ''}`}>{match.awayTeamName}</span>
      </div>

      <div className="gv-momentum__bar">
        <div className="gv-momentum__fill gv-momentum__fill--home" style={{ width: `${homePct}%` }} />
        <div className="gv-momentum__fill gv-momentum__fill--away" style={{ width: `${100 - homePct}%` }} />
        <div className="gv-momentum__needle" style={{ left: `${homePct}%` }} />
      </div>

      <svg className="gv-momentum__spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={mid} x2={W} y2={mid} className="gv-momentum__spark-mid" />
        <polyline points={pts} className="gv-momentum__spark-line" />
      </svg>
    </div>
  );
}
