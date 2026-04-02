import { useEffect, useState } from 'react';
import api from '../api/apiClient';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // FIX: Cleanup on unmount

    const loadProfileData = async () => {
      try {
        setLoading(true);
        setError('');

        // FIX: Both requests run in parallel — was already correct, kept
        const [profileRes, statsRes] = await Promise.all([
          api.get('/Profile/me'),
          api.get('/Profile/stats'),
        ]);

        if (!cancelled) {
          setProfile(profileRes.data);
          setStats(statsRes.data);
        }
      } catch (err) {
        if (!cancelled)
          setError(err?.response?.data?.message || 'Failed to load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfileData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="shell-card profile-state-card">
          <h2>Loading profile...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="shell-card profile-state-card">
          <h2>Profile</h2>
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  }

  const username = profile?.username || 'User';
  const email = profile?.email || '-';
  const role = profile?.role || 'User';
  const firstLetter = username.charAt(0).toUpperCase();

  return (
    <div className="profile-page">
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

      <div className="profile-stats-grid">
        <div className="shell-card profile-stat-card">
          <span>Total Predictions</span>
          <strong>{stats?.totalPredictions ?? 0}</strong>
        </div>

        {/* FIX: scoredPredictions and exactScoreCount don't exist in ProfileStatsDTO —
            removed them. The backend returns: totalPredictions, totalPoints,
            correctOutcomeCount, accuracyPercent. */}
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

      <div className="profile-bottom-layout">
        <div className="shell-card profile-info-card">
          <h3>Account Info</h3>
          <div className="profile-info-item">
            <span>Username</span>
            <strong>{username}</strong>
          </div>
          <div className="profile-info-item">
            <span>Email</span>
            <strong>{email}</strong>
          </div>
          <div className="profile-info-item">
            <span>Role</span>
            <strong>{role}</strong>
          </div>
        </div>

        <div className="shell-card profile-summary-card">
          <h3>Performance Summary</h3>
          <p>
            You have made <strong>{stats?.totalPredictions ?? 0}</strong> predictions and collected{' '}
            <strong>{stats?.totalPoints ?? 0}</strong> points.
          </p>
          <p>
            Your current accuracy is <strong>{stats?.accuracyPercent ?? 0}%</strong>, with{' '}
            <strong>{stats?.correctOutcomeCount ?? 0}</strong> correct outcomes.
          </p>
        </div>
      </div>
    </div>
  );
}