import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import '../landing.css' // adjust this path if landing.css lives somewhere else

// ---------------------------------------------------------------------------
// Small inline icon set — same stroke language as the rest of the app
// (stroke="currentColor", strokeWidth 2, round caps/joins, 24x24 viewBox)
// so the landing page reads as the same product, not a separate template.
// ---------------------------------------------------------------------------
const Icon = {
  Claim: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  Route: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
      <path d="M9 6h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3" />
    </svg>
  ),
  Layers: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" />
    </svg>
  ),
  Chart: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M12 10v8" /><path d="M17 6v12" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  ),
}

// ---------------------------------------------------------------------------
// Splash / boot sequence — shown once per browser session
// ---------------------------------------------------------------------------
// sessionStorage (not localStorage) is the right tool here: it persists
// across reloads and navigation within the same tab, but is wiped the
// moment the browser (or that tab's session) closes — which is exactly
// "shown once until the browser closes." A brand-new tab gets its own
// sessionStorage, so it will boot again there; that's expected sessionStorage
// behavior, not a bug — localStorage would be the fix if you instead want
// "once ever, even in new tabs," but that also means real returning visitors
// would never see it again either.
const BOOT_SESSION_KEY = 'ticketdesk:boot-shown'

function hasBootedThisSession() {
  if (typeof window === 'undefined') return true
  try {
    return window.sessionStorage.getItem(BOOT_SESSION_KEY) === '1'
  } catch {
    // sessionStorage can throw in locked-down/private contexts — fail open
    // (skip the boot) rather than break the page.
    return true
  }
}

function markBootedThisSession() {
  try {
    window.sessionStorage.setItem(BOOT_SESSION_KEY, '1')
  } catch {
    /* ignore — worst case it boots again next time */
  }
}

// ---------------------------------------------------------------------------
// Motion hooks
// ---------------------------------------------------------------------------

/** True once the element has scrolled into view (fires once, then disconnects). */
function useInView(threshold = 0.2) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return [ref, inView]
}

/** Wraps children in a fade/rise reveal, staggered by `index` within its group. */
function Reveal({ as: Tag = 'div', index = 0, className = '', scale = false, children, ...rest }) {
  const [ref, inView] = useInView()
  return (
    <Tag
      ref={ref}
      className={`reveal${scale ? ' reveal--scale' : ''}${inView ? ' is-visible' : ''} ${className}`}
      style={{ '--stagger': index }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Animates a numeric value counting up once its container scrolls into view. */
function useCountUp(target, { duration = 1200, decimals = 0, start: startValue = 0 } = {}) {
  const [ref, inView] = useInView(0.6)
  const [value, setValue] = useState(startValue)

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(startValue + (target - startValue) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target, duration, startValue])

  return [ref, decimals ? value.toFixed(decimals) : Math.round(value)]
}

function StatValue({ target, decimals = 0, prefix = '', suffix = '' }) {
  const [ref, display] = useCountUp(target, { decimals })
  return (
    <span ref={ref} className="landing-stat-value">
      {prefix}{display}{suffix}
    </span>
  )
}

/** Types out a rotating log of console lines, one character at a time. */
function useConsoleFeed(lines) {
  const [i, setI] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [done, setDone] = useState([])
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) {
      setDone(lines.map((l) => l.text))
      setI(lines.length)
      return
    }
    const current = lines[i % lines.length]
    if (charCount < current.text.length) {
      const t = setTimeout(() => setCharCount((c) => c + 1), 22 + Math.random() * 26)
      return () => clearTimeout(t)
    }
    const pause = setTimeout(() => {
      setDone((d) => {
        const next = [...d, current.text]
        return next.length > 4 ? next.slice(next.length - 4) : next
      })
      setCharCount(0)
      setI((n) => n + 1)
    }, 900)
    return () => clearTimeout(pause)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charCount, i])

  const current = lines[i % lines.length]
  const typedCurrent = reduced ? '' : current.text.slice(0, charCount)
  return { history: done, current: typedCurrent, tag: current.tag, showCursor: charCount < current.text.length }
}

/**
 * The page's unique entrance: a full-viewport console "boot" overlay that
 * types an init line, fills a progress rule, then iris-wipes shut toward
 * the nav's logo mark — uncovering the hero exactly as its own staggered
 * reveal begins. Skipped entirely under prefers-reduced-motion, and skipped
 * after the first time it's played in this browser session (see onDone).
 */
function BootOverlay({ onDone }) {
  const FULL_TEXT = 'INITIALIZING TICKET DESK CONSOLE'
  const [typed, setTyped] = useState('')
  const [barPct, setBarPct] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let i = 0
    const typeTimer = setInterval(() => {
      i += 1
      setTyped(FULL_TEXT.slice(0, i))
      if (i >= FULL_TEXT.length) clearInterval(typeTimer)
    }, 26)

    const barTimer = setTimeout(() => setBarPct(100), 80)

    const exitTimer = setTimeout(() => {
      const mark = document.querySelector('.landing-brand-mark')
      if (mark) {
        const rect = mark.getBoundingClientRect()
        document.documentElement.style.setProperty('--boot-exit-x', `${rect.left + rect.width / 2}px`)
        document.documentElement.style.setProperty('--boot-exit-y', `${rect.top + rect.height / 2}px`)
      }
      setExiting(true)
      onDone()
    }, 1450)

    return () => {
      clearInterval(typeTimer)
      clearTimeout(barTimer)
      clearTimeout(exitTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`landing-boot${exiting ? ' is-exiting' : ''}`}
      style={{ '--exit-x': 'var(--boot-exit-x, 40px)', '--exit-y': 'var(--boot-exit-y, 34px)' }}
      aria-hidden="true"
    >
      <div className="landing-boot-mark">TD</div>
      <div className="landing-boot-line">
        {typed}
        <span className="landing-boot-cursor" />
      </div>
      <div className="landing-boot-bar">
        <div className="landing-boot-bar-fill" style={{ width: `${barPct}%` }} />
      </div>
    </div>
  )
}

const CONSOLE_LINES = [
  { tag: 'claim', text: 'TD-2291 claimed by @maya · 0.4s' },
  { tag: 'transfer', text: 'TD-2286 transferred: billing → network' },
  { tag: 'resolve', text: 'TD-2280 resolved · 1st response 6m' },
  { tag: 'claim', text: 'TD-2294 offered to 3 staff, claimed by @arjun' },
  { tag: 'transfer', text: 'TD-2288 escalated to admin · urgent' },
]

const MOCK_TICKETS = {
  open: [
    { id: 'TD-2291', subj: 'VPN drops on WFH days', pri: 'high' },
    { id: 'TD-2294', subj: 'Invoice PDF missing GST', pri: 'medium' },
  ],
  progress: [
    { id: 'TD-2288', subj: 'Printer offline — 3rd floor', pri: 'urgent' },
  ],
  resolved: [
    { id: 'TD-2280', subj: 'Password reset — locked out', pri: 'low' },
  ],
}

function MiniChip({ children, tone }) {
  return <span className={`landing-chip landing-chip--${tone}`}>{children}</span>
}

function MockTicket({ t, floating }) {
  return (
    <div className={`mock-ticket${floating ? ' mock-ticket--float' : ''}`}>
      <span className={`mock-pri mock-pri--${t.pri}`} />
      <div className="mock-ticket-body">
        <div className="mock-tid">{t.id}</div>
        <div className="mock-subj">{t.subj}</div>
      </div>
    </div>
  )
}

/** Splits a headline into <span class="word"> pieces so CSS can stagger them in on load. */
function AnimatedWords({ text, startIndex = 0 }) {
  return text.split(' ').map((w, idx) => (
    <span key={idx} className="word" style={{ '--i': startIndex + idx }}>
      {w}{idx < text.split(' ').length - 1 ? '\u00A0' : ''}
    </span>
  ))
}

// ---------------------------------------------------------------------------
// Click ripple for .landing-btn-primary buttons — same behavior as the
// login page's submit button ripple, generalized here since these are
// react-router <Link>s (render as <a>) rather than <button>s. Purely
// decorative: doesn't touch navigation.
// ---------------------------------------------------------------------------
function spawnButtonRipple(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.4
  const ripple = document.createElement('span')
  ripple.className = 'landing-btn-ripple'
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  el.appendChild(ripple)
  setTimeout(() => ripple.remove(), 650)
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  // Boot overlay plays only if: motion isn't reduced AND it hasn't already
  // played earlier in this browser session (tab). Computed once, synchronously,
  // before first paint, so there's no flash-of-boot-then-hide on repeat visits.
  const [skipBoot] = useState(() => {
    if (typeof window === 'undefined') return true
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    return Boolean(reduced) || hasBootedThisSession()
  })
  const [booted, setBooted] = useState(skipBoot)
  const feed = useConsoleFeed(CONSOLE_LINES)

  const handleBootDone = useCallback(() => {
    setBooted(true)
    markBootedThisSession()
  }, [])

  const onScroll = useCallback(() => setScrolled(window.scrollY > 8), [])
  useEffect(() => {
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [onScroll])

  // Lock scroll while the boot sequence is playing so the reveal feels intentional.
  useEffect(() => {
    if (skipBoot) return
    document.body.style.overflow = booted ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [booted, skipBoot])

  return (
    <div className="landing">

      {!skipBoot && <BootOverlay onDone={handleBootDone} />}

      {/* ---------------- Nav ---------------- */}
      <header className={`landing-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="landing-brand-mark">TD</span>
            <span className="landing-brand-text">
              <span className="landing-brand-name">Ticket Desk</span>
              <span className="landing-brand-sub">Ops console for support teams</span>
            </span>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">Log in</Link>
            <Link to="/onboarding" className="landing-btn landing-btn-primary" onMouseDown={spawnButtonRipple}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className={`landing-hero${booted ? ' is-booted' : ''}`}>
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="landing-eyebrow-dot" />
              Live dispatch, not a shared inbox
            </div>
            <h1 className="landing-h1">
              <AnimatedWords text="Every ticket," startIndex={0} />{' '}
              <span className="landing-h1-accent" style={{ display: 'inline-block' }}>
                claimed
              </span>{' '}
              <AnimatedWords text="— never dropped, never doubled." startIndex={3} />
            </h1>
            <p className="landing-sub">
              Ticket Desk routes support requests to the right person, locks claims so nobody
              collides, and gives customers, staff, and admins a dashboard actually built for
              what they do — not one shared view stretched three ways.
            </p>
            <div className="landing-hero-actions">
              <Link
                to="/onboarding"
                className="landing-btn landing-btn-primary landing-btn-lg"
                onMouseDown={spawnButtonRipple}
              >
                <span className="btn-label">Get started free</span>
                <Icon.Arrow className="btn-arrow" width="16" height="16" />
              </Link>
              <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-lg">Log in</Link>
            </div>
            <div className="landing-hero-proof">
              <div><strong>Race-safe</strong> ticket claiming</div>
              <div><strong>Real-time</strong> escalation trail</div>
              <div><strong>Role-built</strong> dashboards</div>
            </div>
          </div>

          <div className="landing-hero-visual" aria-hidden="true">
            <div className="mock-window">
              <div className="mock-titlebar">
                <span className="mock-dot" style={{ background: '#E7A64C' }} />
                <span className="mock-dot" style={{ background: '#39D6A1' }} />
                <span className="mock-dot" style={{ background: '#E77A67' }} />
                <span className="mock-titlebar-label">Ticket Assignment — live</span>
              </div>
              <div className="mock-ticker">
                <span className="mock-ticker-dot" /> LIVE&nbsp;&nbsp;<b>4</b>&nbsp;open&nbsp;&middot;&nbsp;<b>1</b>&nbsp;in progress&nbsp;&middot;&nbsp;<b>1</b>&nbsp;resolved today
              </div>

              {/* typewriter console feed — mirrors real claim/transfer/resolve events */}
              <div className="mock-console">
                {feed.history.map((line, idx) => (
                  <div className="mock-console-line" key={idx}>
                    <span className="t">{'>'}</span>
                    <span>{line}</span>
                  </div>
                ))}
                <div className="mock-console-line">
                  <span className="t">{'>'}</span>
                  <span>{feed.current}</span>
                  {feed.showCursor && <span className="mock-console-cursor" />}
                </div>
              </div>

              <div className="mock-board">
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="amber">Open</MiniChip></div>
                  {MOCK_TICKETS.open.map((t) => <MockTicket key={t.id} t={t} />)}
                </div>
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="blue">In Progress</MiniChip></div>
                  <MockTicket t={MOCK_TICKETS.progress[0]} floating />
                </div>
                <div className="mock-col">
                  <div className="mock-col-head"><MiniChip tone="accent">Resolved</MiniChip></div>
                  {MOCK_TICKETS.resolved.map((t) => <MockTicket key={t.id} t={t} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}