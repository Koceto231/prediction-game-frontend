import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/apiClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');

    try {
      const response = await api.post('/Auth/forgot-password', { email });
      setFeedback(
        response.data?.message ||
          'If an account with that email exists, a reset link has been sent.'
      );
      setSent(true);
    } catch (err) {
      setFeedback(
        err?.response?.data?.message ||
          err.message ||
          'Failed to send reset email.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="shell-card auth-card">
        <h1>Forgot Password</h1>
        <p>Enter your email and we’ll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || sent}
          />

          <button
            className="primary-button"
            type="submit"
            disabled={loading || sent || !email.trim()}
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-footer-links">
          <Link to="/login">Back to login</Link>
        </div>

        {feedback && <div className="alert alert-info">{feedback}</div>}
      </div>
    </div>
  );
}

