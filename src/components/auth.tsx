import { useState, FormEvent } from 'react'
import { api } from '../services/api'
import { auth } from '../services/auth'

interface AuthProps {
  onLogin: () => void
}

export function Auth({ onLogin }: AuthProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegistering) {
        const response = await api.register(email, password, code)
        if (response.error) {
          setError(response.error)
          return
        }
        // Auto-login after registration
        const loginResponse = await api.login(email, password)
        if (loginResponse.error) {
          setError(loginResponse.error)
          return
        }
        if (loginResponse.token) {
          auth.setToken(loginResponse.token)
          onLogin()
        } else {
          // Treat successful response without error as logged in (cookie-based auth)
          onLogin()
        }
      } else {
        const response = await api.login(email, password)
        if (response.error) {
          setError(response.error)
          return
        }
        if (response.token) {
          auth.setToken(response.token)
          onLogin()
        } else {
          // Treat successful response without error as logged in (cookie-based auth)
          onLogin()
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">
          {isRegistering ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div className="auth-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="on">
          <div className="form-group">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="username"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div className="password-input-group">
              <input
                id="auth-password"
                name="current-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                disabled={loading}
                autoComplete={isRegistering ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="password-icon">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="password-icon">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="auth-code">Registration Code</label>
              <input
                id="auth-code"
                name="registration-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="form-input"
                disabled={loading}
                autoComplete="off"
              />
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>

        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="toggle-auth-button"
          disabled={loading}
        >
          {isRegistering 
            ? 'Already have an account? Sign in' 
            : 'Need an account? Register'}
        </button>
      </div>
    </div>
  )
}