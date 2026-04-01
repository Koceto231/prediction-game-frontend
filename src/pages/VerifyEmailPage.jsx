import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/apiClient';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        setTimeout(() => navigate('/login'), 2500);
        return;
      }

      try {
        const response = await api.get(`/Auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(response.data?.message || 'Email verified successfully.');
        setTimeout(() => navigate('/login?verified=true'), 2500);
      } catch (err) {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Invalid or expired token.');
        setTimeout(() => navigate('/login?verified=false'), 2500);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="verify-container">
      <div className="verify-card">
        {status === 'loading' && <h2>⏳ {message}</h2>}
        {status === 'success' && (
          <>
            <h2>✅ Success</h2>
            <p>{message}</p>
            <span>Redirecting to login...</span>
          </>
        )}
        {status === 'error' && (
          <>
            <h2>❌ Error</h2>
            <p>{message}</p>
            <span>Redirecting to login...</span>
          </>
        )}
      </div>
    </div>
  );
}