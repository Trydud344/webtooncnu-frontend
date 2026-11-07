import { useState } from 'react'
import { writeSignedIn } from './session.js'
import { useTurnstile, withTurnstile } from './turnstile.js'

export default function Login({ onBack, onSignup, onEnter }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const loginCheck = useTurnstile('login')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const response = await withTurnstile(loginCheck, (turnstile_token) => fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, turnstile_token }),
      }))
      const text = await response.text()
      const data = text ? JSON.parse(text) : null
      if (!response.ok) throw new Error(data?.detail || 'Autentificarea a eșuat.')
      if (data.account?.role !== 'team' && data.account?.role !== 'jury') {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-session': 'admin' },
        }).catch(() => {})
        setError('Contul nu este de echipă.')
        return
      }
      writeSignedIn(true)
      onEnter(data.account)
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'API-ul nu răspunde.' : err.message)
    }
  }

  return (
    <main className="page login-page">
      <header className="hero">
        <h1>log in</h1>
        <p className="lede">
          Intră în contul echipei sau al juriului pentru a continua.
        </p>
      </header>

      <section>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>email</span>
            <input
              type="email"
              name="email"
              placeholder="nume@exemplu.ro"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>parolă</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="turnstile-group">
            <div ref={loginCheck.containerRef} className="turnstile" />
          </div>
          <div className="actions">
            <button type="submit" className="text-btn">intră</button>
            <a
              className="text-btn"
              href="/acasa"
              onClick={(event) => {
                event.preventDefault()
                onBack()
              }}
            >
              înapoi
            </a>
          </div>
          <p>
            <button type="button" className="text-btn" onClick={onSignup}>
              creează cont
            </button>
          </p>
        </form>
      </section>
    </main>
  )
}
