# BPFL Frontend

React 18 + Vite frontend for the **Best Prediction Football League** — a
social football prediction and fantasy game.

Live: <https://prediction-game-frontend.vercel.app/> (Vercel)
Backend: [BPFL.API](https://github.com/Koceto231/prediction-game-backend)

---

## Tech stack

| Layer            | Tech                                             |
| ---------------- | ------------------------------------------------ |
| Framework        | React 18                                         |
| Bundler          | Vite 5                                           |
| Router           | react-router-dom 6                               |
| HTTP             | axios                                            |
| Auth             | JWT cookies + Google OAuth (`@react-oauth/google`) |
| Real-time        | Server-Sent Events (`useLiveMatchStream` hook)   |
| Monitoring       | Sentry (errors + 10 % perf traces + replay-on-error) |
| Hosting          | Vercel                                           |

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 with HMR
npm run build        # production build to ./dist
npm run preview      # serve the production build locally
```

A backend API is required for most pages to do anything. Point the dev
build at one via `VITE_API_BASE_URL` (see "Environment" below).

---

## Project layout

```
src/
├── api/               # axios instance + idempotency helpers
├── components/        # shared UI (MatchCard, BetSlipPanel, …)
├── context/           # AuthContext, WalletContext (global state)
├── hooks/             # useLiveMatchStream, useNowTicker, useLiveEventQueue
├── pages/             # route-level components (MatchesPage, LivePage, …)
├── styles/            # global.css — the single Gridiron-Velocity theme
├── utils/             # cross-page helpers (liveState formatters, etc.)
├── App.jsx            # router + mounted-everywhere components (slip, ticker)
└── main.jsx           # entry point — Sentry init, providers, ErrorBoundary
```

### Notable components

| File                       | Role                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `BetSlipPanel.jsx`         | Global bottom-right multi-column slip (8888-style expand/collapse).  |
| `MatchCard.jsx`            | Single-match card on the Matches page; dispatches odd-clicks → slip. |
| `LiveMatchCard.jsx`        | Variant used on the Live page with elapsed minute + score.           |
| `OddsTicker.jsx`           | Fixed bottom marquee of the day's top odds.                          |
| `Navbar.jsx`               | Top nav with wallet balance + live-match counter.                    |

### Notable pages

| File                           | Role                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `MatchesPage.jsx`              | List of upcoming matches + match-detail with all markets.    |
| `LivePage.jsx`                 | In-progress matches with pitch tracker + event ticker.       |
| `BetsPage.jsx`                 | "My Bets" — history, settled, cash-out.                      |
| `PredictionsPage.jsx`          | Free-tier AI predictions feed.                               |
| `FantasyDraftPage.jsx`         | Pick a fantasy XI for a gameweek.                            |
| `FantasyLeaderboardPage.jsx`   | Weekly + season fantasy scores.                              |
| `AdminPage.jsx`                | Sportmonks sync controls, venue lookup, manual scoring.      |

---

## Environment

| Variable                  | Required           | Description                                             |
| ------------------------- | ------------------ | ------------------------------------------------------- |
| `VITE_API_BASE_URL`       | Yes (build & dev)  | Backend root, e.g. `https://api.bpfl.app`               |
| `VITE_GOOGLE_CLIENT_ID`   | For Google login   | OAuth 2 client ID from Google Cloud Console             |
| `VITE_SENTRY_DSN`         | Optional           | Sentry DSN; when omitted, Sentry init is skipped         |

Set them in `.env.local` for dev, or in Vercel → Settings → Environment
Variables for production / preview.

---

## Real-time updates

Live scores, events and clock are pushed via **Server-Sent Events** from
`GET /api/Match/stream` instead of being polled. `useLiveMatchStream`
subscribes once at app start and broadcasts each update through a tiny
in-process pub/sub so every component (LivePage, LiveNowSidebar, Navbar
counter, ...) sees the same snapshot at the same time.

Polling fallback: the same hook also runs a 5 s `setInterval` if the
`EventSource` connection can't open (e.g. behind a proxy that strips
SSE) — the rest of the app doesn't notice the difference.

---

## Bet Slip architecture

The Bet Slip is the heart of the UX. It's:

- **Global** — mounted once in `App.jsx`, persists across navigation
- **Multi-column** — each "колонка" is an independent ticket with its own
  picks and stake. Submit fires N requests in parallel
- **Same-game accumulator capable** — multiple picks from the same fixture
  coexist inside one column, deduped by `(matchId + market + selection)`
- **Conflict-aware** — refuses combinations that are mathematically
  impossible to win (Winner Home + Goals Under 0.5, etc.)
- **Storage-resilient** — picks are persisted to `localStorage` under
  `bpfl:slip:columns` so a refresh doesn't drop the user's work

Picks flow in via a single CustomEvent:

```js
window.dispatchEvent(new CustomEvent('bpfl:slip:add', {
  detail: { matchId, betType, pick, odds, fixture, leagueLabel, line, scoreHome, scoreAway },
}));
```

Any UI element (MatchCard's 1/X/2 buttons, exact-score tiles, live-page
odds, …) can opt in without prop drilling.

---

## CI

GitHub Actions runs `npm run build` on every push to `main` and on every
pull request (see `.github/workflows/ci.yml`). The build acts as our
type-check + lint — Vite refuses syntax errors, missing imports and
broken JSX.

---

## License

Proprietary. © Konstantin Karamanov.
