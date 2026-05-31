import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../api/apiClient';

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('info');
  const [loading, setLoading] = useState(false);

  // ── Invitation token from URL — closes registration to non-invited users.
  const inviteToken = searchParams.get('invite') || '';
  const [inviteOk, setInviteOk] = useState(null); // null=loading, true/false

  useEffect(() => {
    const verified = searchParams.get('verified');
    const reset = searchParams.get('reset');

    if (verified === 'true') {
      setFeedback('Имейлът е потвърден. Можеш да влезеш.');
      setFeedbackType('success');
    } else if (verified === 'false') {
      setFeedback('Потвърждението на имейла се провали или линкът е изтекъл.');
      setFeedbackType('error');
    } else if (reset === 'success') {
      setFeedback('Паролата е сменена. Можеш да влезеш.');
      setFeedbackType('success');
    }

    // If the URL carries an invite token, jump to register mode and resolve
    // the token so we can pre-fill the email and lock it from edits.
    if (inviteToken) {
      setMode('register');
      api.get(`/Auth/invite/${encodeURIComponent(inviteToken)}`)
        .then(r => {
          setEmail(r.data?.email || '');
          setInviteOk(true);
        })
        .catch(err => {
          setInviteOk(false);
          setFeedback(err?.response?.data?.message || 'Невалидна или изтекла покана.');
          setFeedbackType('error');
        });
    }
  }, [searchParams, inviteToken]);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');
    setFeedbackType('info');
    try {
      await login(email, password);
      navigate('/matches');
    } catch (err) {
      setFeedback(err?.response?.data?.message || 'Login failed.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!inviteToken) {
      setFeedback('Регистрацията изисква покана от админ.');
      setFeedbackType('error');
      return;
    }
    setLoading(true);
    setFeedback('');
    setFeedbackType('info');
    try {
      await register(username, email, password, inviteToken);
      setFeedback('Регистрацията е успешна. Можеш да влезеш.');
      setFeedbackType('success');
      setMode('login');
      setPassword('');
    } catch (err) {
      setFeedback(err?.response?.data?.message || err.message || 'Регистрацията се провали.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setFeedback('');
      setFeedbackType('info');
      await loginWithGoogle(credentialResponse.credential);
      navigate('/matches');
    } catch (err) {
      setFeedback(err?.response?.data?.message || err.message || 'Google login failed.');
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setFeedback('Google login failed.');
    setFeedbackType('error');
  };

  return (
    <div className="login-shell">
      <div className="shell-card auth-card">
        <div className="auth-eyebrow">Match Predictor</div>
        <h1>Welcome back</h1>
        <p>Sign in to your account to continue</p>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setFeedback(''); }}
            type="button"
          >
            Login
          </button>
          {/* Register tab only shows up when an invite token is present —
              the rest of the time registration is closed. */}
          {inviteToken && (
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setFeedback(''); }}
              type="button"
            >
              Register
            </button>
          )}
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="auth-links-row">
              <Link to="/forgot-password" className="text-link">Forgot password?</Link>
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>

            <div className="auth-divider"><span>or continue with</span></div>

            <div className="google-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                size="large"
                shape="pill"
                text="signin_with"
                width="320"
                locale="en"
              />
            </div>
          </form>
        ) : !inviteToken ? (
          <div className="alert alert-info" style={{ marginTop: 16 }}>
            Регистрацията в системата е по покана. Свържи се с админ за
            достъп — той ще ти изпрати имейл с линк за регистрация.
          </div>
        ) : inviteOk === false ? (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            Поканата е невалидна или изтекла. Свържи се с админ за нова.
          </div>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-username">Потребителско име</label>
              <input
                id="reg-username"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-email">Email адрес</label>
              <input
                id="reg-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                readOnly
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
              <div className="muted-text" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                Имейлът е фиксиран от поканата.
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-password">Парола</label>
              <input
                id="reg-password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="password-rules">
              <div className="password-rules__title">Паролата трябва да съдържа:</div>
              <ul>
                <li className={passwordChecks.length ? 'rule-ok' : ''}>Поне 8 символа</li>
                <li className={passwordChecks.upper ? 'rule-ok' : ''}>Поне 1 главна буква</li>
                <li className={passwordChecks.lower ? 'rule-ok' : ''}>Поне 1 малка буква</li>
                <li className={passwordChecks.number ? 'rule-ok' : ''}>Поне 1 цифра</li>
                <li className={passwordChecks.special ? 'rule-ok' : ''}>Поне 1 специален знак</li>
              </ul>
            </div>

            <button className="primary-button" type="submit" disabled={loading || inviteOk !== true}>
              {loading ? 'Създаване…' : 'Създай профил →'}
            </button>
          </form>
        )}

        {feedback && (
          <div className={`alert ${
            feedbackType === 'success' ? 'alert-success' :
            feedbackType === 'error'   ? 'alert-error'   : 'alert-info'
          }`}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}
