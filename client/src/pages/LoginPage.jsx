import { useState } from 'react';
import { authApi } from '../lib/api';

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!identifier.trim() || !password) {
      setMessage('Please enter your email/roll number and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.login({
        identifier: identifier.trim(),
        password,
      });
      onLogin(result.user);
    } catch (error) {
      setMessage(error.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-brand">
        <div className="logo">E</div>

        <div>
          <h1>EduLearn</h1>
          <p>Learning Management System</p>
        </div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <h2>Welcome Back</h2>
        <p className="subtitle">Login to continue to EduLearn</p>

        <div className="form-group">
          <label htmlFor="loginIdentifier">Email / Roll Number</label>
          <input
            id="loginIdentifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter email or roll number"
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="primary-btn login-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {message && (
          <p className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
