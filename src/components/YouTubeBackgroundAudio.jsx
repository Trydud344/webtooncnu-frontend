import { useEffect, useRef } from 'react'

// Accepts watch, youtu.be, embed, shorts, live and v URLs, plus a bare id.
export function parseYouTubeId(value) {
  const raw = (value || '').trim()
  if (!raw) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw
  let url = null
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  const isId = (id) => (/^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null)
  if (host === 'youtu.be') return isId(url.pathname.split('/').filter(Boolean)[0])
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.pathname === '/watch') return isId(url.searchParams.get('v'))
    const parts = url.pathname.split('/').filter(Boolean)
    if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) return isId(parts[1])
  }
  return null
}

let apiPromise = null
function loadYouTubeAPI() {
  if (apiPromise) return apiPromise
  if (window.YT?.Player) return (apiPromise = Promise.resolve(window.YT))
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    tag.onerror = () => reject(new Error('Could not load YouTube.'))
    document.head.appendChild(tag)
  })
  return apiPromise
}

// Audio-only YouTube playback: a 1x1 player the user hears but never sees.
// display:none would refuse to play, so the hiding is opacity + size in CSS.
export default function YouTubeBackgroundAudio({ videoId, playing, volume, onError, onPlayingChange }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const lastVideoRef = useRef(null)
  const stateRef = useRef({ videoId, playing, volume })
  stateRef.current = { videoId, playing, volume }
  const callbacksRef = useRef({ onError, onPlayingChange })
  callbacksRef.current = { onError, onPlayingChange }

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !hostRef.current || playerRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '1',
        height: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: (event) => {
            readyRef.current = true
            try {
              event.target.setVolume(stateRef.current.volume ?? 80)
              event.target.setLoop(true)
            } catch {
              // Volume/loop are niceties; playback works without them.
            }
            const { videoId: id, playing: play } = stateRef.current
            lastVideoRef.current = id
            if (!id) return
            try {
              if (play) event.target.loadVideoById(id)
              else event.target.cueVideoById(id)
            } catch {
              // Player not ready for cues yet; the video effect retries.
            }
          },
          onStateChange: (event) => {
            const states = window.YT?.PlayerState
            if (!states) return
            if (event.data === states.PLAYING) callbacksRef.current.onPlayingChange?.(true)
            else if (event.data === states.PAUSED || event.data === states.CUED) {
              callbacksRef.current.onPlayingChange?.(false)
            } else if (event.data === states.ENDED) {
              try {
                event.target.playVideo()
              } catch {
                // Ended without a replay path; stays stopped.
              }
            }
          },
          onError: () => callbacksRef.current.onError?.(),
        },
      })
    }).catch(() => callbacksRef.current.onError?.())
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !readyRef.current || videoId === lastVideoRef.current) return
    lastVideoRef.current = videoId
    if (!videoId) {
      try {
        player.stopVideo()
        player.clearVideo()
      } catch {
        // Nothing loaded; nothing to clear.
      }
      return
    }
    try {
      if (stateRef.current.playing) player.loadVideoById(videoId)
      else player.cueVideoById(videoId)
    } catch {
      // Transient player state; the next toggle retries.
    }
  }, [videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !readyRef.current || !videoId) return
    try {
      if (playing) player.playVideo()
      else player.pauseVideo()
    } catch {
      // Transient player state; the next toggle retries.
    }
  }, [playing, videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !readyRef.current) return
    try {
      player.setVolume(volume)
    } catch {
      // Volume is a nicety; playback continues at the previous level.
    }
  }, [volume])

  useEffect(() => () => {
    try {
      playerRef.current?.destroy()
    } catch {
      // Player already gone with the page.
    }
    playerRef.current = null
  }, [])

  return (
    <div className="youtube-background-audio" aria-hidden="true">
      <div ref={hostRef} />
    </div>
  )
}
