import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Format a Date as the "YYYY-MM-DD HH:MM" shape the real /api/events returns.
const daysAgo = (days) => {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Fixture is built relative to "now" so it never goes stale.
// Of the 7 signups, only 4 fall inside the last 7 days.
const EVENTS = [
  { user_id: 1001, event: 'signup', event_ts: daysAgo(0), source: 'organic' },
  { user_id: 1002, event: 'signup', event_ts: daysAgo(1), source: 'ads' },
  { user_id: 1003, event: 'signup', event_ts: daysAgo(3), source: 'organic' },
  { user_id: 1004, event: 'signup', event_ts: daysAgo(6), source: 'referral' },

  // Same calendar month, but older than 7 days -> the getMonth() bug counts these.
  { user_id: 1005, event: 'signup', event_ts: daysAgo(10), source: 'organic' },
  { user_id: 1006, event: 'signup', event_ts: daysAgo(14), source: 'ads' },

  // Last month -> correctly excluded by both the buggy and the fixed filter.
  { user_id: 1007, event: 'signup', event_ts: daysAgo(30), source: 'organic' },

  // Same month, previous YEAR -> getMonth() ignores the year, so the bug counts it too.
  { user_id: 1008, event: 'signup', event_ts: daysAgo(365), source: 'organic' },

  // Non-signup event, to prove the ?event= filter is actually applied.
  { user_id: 1009, event: 'login', event_ts: daysAgo(1), source: 'organic' },
]

// Dev-only stub for /api/events. Delays the response so the pre-load
// render path (the "white screen when the API is slow" report) is visible.
function mockApi() {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use('/api/events', (req, res) => {
        const { searchParams } = new URL(req.url, 'http://localhost')
        const wanted = searchParams.get('event')
        const body = wanted ? EVENTS.filter((e) => e.event === wanted) : EVENTS

        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }, 1500)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mockApi()],
})
