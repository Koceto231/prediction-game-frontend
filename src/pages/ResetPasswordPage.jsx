import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/apiClient';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token') || '';
    setToken(queryToken);

    if (!queryToken) {
      setFeedback('Missing reset token.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback('');

    if (!token) {
      setFeedback('Missing reset token.');
      return;
    }

    if (!newPassword.trim()) {
      setFeedback('New password is required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/Auth/reset-password', {
        token,
        newPassword,
      });

      setFeedback(response.data?.message || 'Password reset successfully.');
      setSuccess(true);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setFeedback(
        err?.response?.data?.message ||
          err.message ||
          'Password reset failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="shell-card auth-card">
        <h1>Reset Password</h1>
        <p>Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading || success}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || success}
          />

          <button
            className="primary-button"
            type="submit"
            disabled={loading || success || !token}
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        <div className="auth-footer-links">
          <Link to="/login">Back to login</Link>
        </div>

        {feedback && (
          <div className={`alert ${success ? 'alert-success' : 'alert-info'}`}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}