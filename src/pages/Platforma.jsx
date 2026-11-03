import { useEffect, useState } from 'react'

function formatWhen(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Platforma() {
  const [posts, setPosts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/bulletins')
      .then(async (response) => {
        const text = await response.text()
        const data = text ? JSON.parse(text) : null
        if (!response.ok) throw new Error(data?.detail || 'Anunțurile nu pot fi încărcate.')
        return data
      })
      .then((data) => {
        if (!cancelled) setPosts(data.bulletins)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page">
      <section className="board" aria-label="anunțuri">
        {error ? <p className="form-error">{error}</p> : null}
        {posts === null && !error ? <p>Se încarcă anunțurile…</p> : null}
        {posts && posts.length === 0 ? <p>Nu există anunțuri.</p> : null}
        {posts && posts.map((post) => (
          <article key={post.id} className="board-post">
            <h2>{post.title}</h2>
            <p className="board-when">{formatWhen(post.created_at)}</p>
            <p className="board-body">{post.body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
