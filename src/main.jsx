import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import './styles/global.css';

// ── Sentry init ──────────────────────────────────────────────────────────────
// Reports unhandled JS errors, React render crashes, and a 10 % sample of
// page transitions for performance. Only active when VITE_SENTRY_DSN is set
// in the environment (Vercel project settings) — local dev stays quiet.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,            // 10 % of transactions for perf metrics
    replaysSessionSampleRate: 0.0,    // never record happy-path sessions
    replaysOnErrorSampleRate: 1.0,    // always record the 30 s before an error
    ignoreErrors: [
      // Browser-extension / runtime noise; not actionable in our code.
      'top.GLOBALS',
      'ResizeObserver loop',
      'AbortError: The operation was aborted',
    ],
    // Don't leak email / token-bearing PII.
    sendDefaultPii: false,
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: 24, textAlign: 'center', color: 'var(--text-main, #f3f1ec)',
        }}>
          <h2 style={{ color: 'var(--accent, #f0c519)' }}>Нещо се счупи</h2>
          <p style={{ maxWidth: 420 }}>
            Възникна неочаквана грешка. Опитай отново или презареди страницата.
          </p>
          <button
            type="button"
            onClick={resetError}
            style={{
              padding: '10px 20px', background: 'var(--accent, #f0c519)',
              color: '#06120a', border: 'none', borderRadius: 4,
              fontWeight: 800, cursor: 'pointer',
            }}
          >Опитай отново</button>
        </div>
      )}
    >
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
