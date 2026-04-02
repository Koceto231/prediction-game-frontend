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

  useEffect(() => {
    const verified = searchParams.get('verified');
    const reset = searchParams.get('reset');

    if (verified === 'true') {
      setFeedback('Email verified successfully. You can now log in.');
      setFeedbackType('success');
    } else if (verified === 'false') {
      setFeedback('Email verification failed or the link has expired.');
      setFeedbackType('error');
    } else if (reset === 'success') {
      setFeedback('Password reset successfully. You can now log in.');
      setFeedbackType('success');
    }
  }, [searchParams]);

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
    setLoading(true);
    setFeedback('');
    setFeedbackType('info');

    try {
      await register(username, email, password);
      setFeedback('Registration successful. Check your email for a verification link, then log in.');
      setFeedbackType('success');
      setMode('login');
      setPassword('');
    } catch (err) {
      setFeedback(err?.response?.data?.message || err.message || 'Register failed.');
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
      setFeedback(
        err?.response?.data?.message ||
          err.message ||
          'Google login failed.'
      );
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
        <h1>BPFL Predictor</h1>
        <p>Modern football prediction app</p>

        <div className="auth-switch">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setFeedback('');
            }}
            type="button"
          >
            Login
          </button>

          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setFeedback('');
            }}
            type="button"
          >
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Login'}
            </button>

            <div className="auth-links-row">
              <Link to="/forgot-password" className="text-link">
                Forgot password?
              </Link>
            </div>

            <div className="auth-divider">
              <span>or</span>
            </div>

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
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <div className="password-rules">
              <div className="password-rules__title">Password must contain:</div>
              <ul>
                <li className={passwordChecks.length ? 'rule-ok' : ''}>At least 8 characters</li>
                <li className={passwordChecks.upper ? 'rule-ok' : ''}>At least 1 uppercase letter</li>
                <li className={passwordChecks.lower ? 'rule-ok' : ''}>At least 1 lowercase letter</li>
                <li className={passwordChecks.number ? 'rule-ok' : ''}>At least 1 number</li>
                <li className={passwordChecks.special ? 'rule-ok' : ''}>At least 1 special character</li>
              </ul>
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Register'}
            </button>
          </form>
        )}

        {feedback && (
          <div
            className={`alert ${
              feedbackType === 'success'
                ? 'alert-success'
                : feedbackType === 'error'
                ? 'alert-error'
                : 'alert-info'
            }`}
          >
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}