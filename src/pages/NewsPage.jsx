import { useEffect, useState } from 'react';
import api from '../api/apiClient';

const TYPE_FILTERS = [
  { key: '',              label: 'All' },
  { key: 'MatchPreview',  label: 'Previews' },
  { key: 'MatchReport',   label: 'Reports' },
  { key: 'LeagueSummary', label: 'Summaries' },
];

const TYPE_CONFIG = {
  MatchPreview:   { icon: '🔍', color: '#60aaff' },
  MatchReport:    { icon: '📋', color: '#7aff8a' },
  LeagueSummary:  { icon: '📊', color: '#ffb400' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'Just now';
}

export default function NewsPage() {
  const [articles, setArticles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    const qs = filter ? `?type=${filter}&take=30` : '?take=30';
    api.get(`/News${qs}`)
      .then(r => setArticles(r.data))
      .catch(() => setError('Failed to load news.'))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="page-grid">
      <section className="shell-card panel">

        <div className="section-head">
          <div>
            <h2>📰 News</h2>
            <p>AI-generated match previews, reports and league summaries.</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="pos-tabs" style={{ marginBottom: 20 }}>
          {TYPE_FILTERS.map(f => (
            <button key={f.key} type="button"
              className={`pos-tab ${filter === f.key ? 'pos-tab--active' : ''}`}
              onClick={() => { setFilter(f.key); setExpandedId(null); }}>
              {f.label}
            </button>
          ))}
        </div>

        {error   && <div className="alert alert-error">{error}</div>}
        {loading && <div className="empty-box">Loading news...</div>}

        {!loading && articles.length === 0 && !error && (
          <div className="empty-box">No articles yet — check back soon.</div>
        )}

        <div className="news-list">
          {articles.map(article => {
            const cfg        = TYPE_CONFIG[article.type] ?? { icon: '📄', color: 'var(--text-muted)' };
            const isExpanded = expandedId === article.id;

            return (
              <div key={article.id}
                className="news-card shell-card"
                onClick={() => setExpandedId(isExpanded ? null : article.id)}>

                <div className="news-card__header">
                  <span className="news-card__type-badge" style={{ color: cfg.color }}>
                    {cfg.icon} {article.typeLabel}
                  </span>
                  <span className="news-card__time">{timeAgo(article.generatedAt)}</span>
                </div>

                <h3 className="news-card__title">{article.title}</h3>

                {article.homeTeam && article.awayTeam && (
                  <div className="news-card__fixture">
                    {article.homeTeam} vs {article.awayTeam}
                  </div>
                )}
                {article.leagueCode && !article.homeTeam && (
                  <div className="news-card__fixture">
                    League: {article.leagueCode}
                  </div>
                )}

                {/* Preview — first 120 chars when collapsed */}
                {!isExpanded && (
                  <p className="news-card__preview">
                    {article.body.slice(0, 120)}{article.body.length > 120 ? '…' : ''}
                  </p>
                )}

                {/* Full body when expanded */}
                {isExpanded && (
                  <div className="news-card__body">
                    {article.body.split('\n').map((para, i) =>
                      para.trim() ? <p key={i}>{para}</p> : null
                    )}
                  </div>
                )}

                <div className="news-card__footer">
                  <span className="news-card__read-more">
                    {isExpanded ? '▲ Collapse' : '▼ Read more'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </section>
    </div>
  );
}
