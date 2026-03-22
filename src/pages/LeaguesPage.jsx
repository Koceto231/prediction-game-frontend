import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadLeagues = async () => {
    try {
      setLoading(true);
      setFeedback('');
      const response = await api.get('/League/my');
      setLeagues(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to load leagues.');
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeagues();
  }, []);

  const handleCreateLeague = async (e) => {
    e.preventDefault();

    try {
      setFeedback('');
      await api.post('/League', { name: leagueName });
      setLeagueName('');
      setFeedback('League created successfully.');
      await loadLeagues();
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to create league.');
    }
  };

  const handleJoinLeague = async (e) => {
    e.preventDefault();

    try {
      setFeedback('');
      await api.post('/League/join', { inviteCode });
      setInviteCode('');
      setFeedback('Joined league successfully.');
      await loadLeagues();
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to join league.');
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    try {
      setFeedback('');
      await api.delete(`/League/${leagueId}/leave`);
      setFeedback('League left successfully.');
      await loadLeagues();
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to leave league.');
    }
  };

  const handleDeleteLeague = async (leagueId) => {
    try {
      setFeedback('');
      await api.delete(`/League/${leagueId}`);
      setFeedback('League deleted successfully.');
      await loadLeagues();
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Failed to delete league.');
    }
  };

  return (
    <div className="page-grid">
      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>Leagues</h2>
            <p>Create a league or join one with an invite code.</p>
          </div>
        </div>

        <div className="form-grid">
          <form onSubmit={handleCreateLeague} className="list-card">
            <div className="list-card__title">Create League</div>
            <label>
              League Name
              <input
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="Enter league name"
              />
            </label>
            <button className="primary-button" type="submit">
              Create League
            </button>
          </form>

          <form onSubmit={handleJoinLeague} className="list-card">
            <div className="list-card__title">Join League</div>
            <label>
              Invite Code
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code"
              />
            </label>
            <button className="primary-button" type="submit">
              Join League
            </button>
          </form>
        </div>

        {feedback && <div className="alert alert-info">{feedback}</div>}
      </section>

      <section className="shell-card panel">
        <div className="section-head">
          <div>
            <h2>My Leagues</h2>
            <p>Your current leagues and actions.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-box">Loading leagues...</div>
        ) : leagues.length === 0 ? (
          <div className="empty-box">You are not in any leagues yet.</div>
        ) : (
          <div className="list-grid">
            {leagues.map((league) => (
              <div key={league.id} className="list-card">
                <div className="list-card__title">{league.name}</div>
                <div className="muted-text">Invite code: {league.inviteCode}</div>
                <div className="muted-text">Owner: {league.ownerUsername}</div>
                <div className="muted-text">Members: {league.memberCount}</div>

                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => navigate(`/leagues/${league.id}`)}
                  >
                    Open League
                  </button>

                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleLeaveLeague(league.id)}
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}