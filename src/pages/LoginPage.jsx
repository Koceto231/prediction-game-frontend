import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');

    try {
      await login(email, password);
      navigate('/matches');
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');

    try {
      await register(username, email, password);
      setFeedback('Registration successful. Now log in.');
      setMode('login');
    } catch (err) {
      setFeedback(err?.response?.data?.message || err.message || 'Register failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="shell-card auth-card">
        <h1>BPFL Predictor</h1>
        <p>Modern football prediction app</p>

        <div className="auth-switch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Login
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Register'}
            </button>
          </form>
        )}

        {feedback && <div className="alert alert-info">{feedback}</div>}
      </div>
    </div>
  );
}
