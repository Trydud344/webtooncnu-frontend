export default function Login({ onBack, onSignup }) {
  return (
    <main className="page login-page">
      <header className="hero">
        <h1>log in</h1>
        <p className="lede">
          Intră în contul echipei sau al juriului pentru a continua.
        </p>
      </header>

      <section>
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            <span>email</span>
            <input type="email" name="email" placeholder="nume@exemplu.ro" autoComplete="email" />
          </label>
          <label className="field">
            <span>parolă</span>
            <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" />
          </label>
          <div className="actions">
            <button type="submit" className="text-btn">intră</button>
            <a
              className="text-btn"
              href="/acasa"
              onClick={(e) => {
                e.preventDefault()
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
