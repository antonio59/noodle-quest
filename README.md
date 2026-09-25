# Noodle Quest

Brain games and board games for the whole family. Train your focus, memory, and flexibility with fun mini-games, then challenge yourself with classic board games — all while vibing to lo-fi beats.

## Features

### 56 Games (8 categories)

| Category | Games |
|----------|-------|
| Memory (9) | Anagram Blast, Copy Cat, Dual N-Back, Fill in the Blank, Flag Match, Map Quiz, Memory Match, Number Ninja, Sudoku |
| Focus (10) | Attention Archery, Breath Bubbles, Color Rush, Echo Tap, Focus Frenzy, Go / No-Go, Grounding Garden, Mirror Match, Patience Pop, Quick Math |
| Flexibility (7) | Cube Twist (3D), Flexibility Frames, Just Right, Mistake Master, Squish Lab, Stroop Challenge, Tetris |
| Motor (4) | Mole Mash, Pattern Painter, Pixel Paint, Steady Hands |
| Social (3) | Emotion Volcano, Empathy Engine, Feelings Faces |
| Sequence (2) | Routine Roadmap, Story Builder |
| Board (17) | 2048, Bingo, Bookworm, Checkers, Chess, Connect Four, Connect Lines, Crossword, Ludo, Minesweeper, Scrabble, Score Four (3D), Snakes & Ladders, Tic-Tac-Toe, UNO, Word Guess, Word Search |
| Breathe (4) | 4-7-8 Calm, Box Breathing, Coherent Breathing, Triangle Breathing |

Board games play against an AI with real search (minimax + alpha-beta) and stage-based difficulty — replaying an early stage is always a gentle match. Two games are fully 3D (three.js): **Cube Twist**, a twisty cube with swipe-to-turn, and **Score Four**, Connect Four in 3D with 76 winning lines. Scrabble validates against your choice of two real lexica — UK & International (SOWPODS) or US & Canada (TWL) — downloaded at runtime; online games use the host's choice so everyone plays by the same words.

Every game has an illustrated tile (flat SVG, tinted by category) generated from `scripts/game-art` with `pnpm art:build`.

### Pass & Play

Nine board games — Checkers, Chess, Connect Four, Ludo, Scrabble, Score Four, Snakes & Ladders, Tic-Tac-Toe and UNO — can be played by 2–4 people sharing one device. Pick seats from the family (or add a guest), take turns, and keep a running tally across rematches (first move rotates each rematch). Card and tile games cover the screen between turns ("Pass to Mia") so nobody sees anyone else's hand. Results are opt-in posts to the family feed; nothing counts toward stars or rankings.

### Puzzle Corner

- **This week's family puzzle** — one crossword or word search (alternating weeks) with the same grid for everyone, a family times board, and a fresh puzzle every Monday (UTC). No streaks.
- **Family-made puzzles** — type 4–15 of your own words (holidays, pets, spelling lists) and play them as a crossword or word search. "Write clues for me" asks Claude (`claude-opus-5`, structured output, server-side fallback) for kid-friendly clues you can edit; without `ANTHROPIC_API_KEY` families write clues by hand.

### Weekly Family Recap

A rolling 7-day card on Home (games played, stars, star of the week, most-played game, challenge results) and a Sunday 17:00 UTC email of the same summary to `ADMIN_EMAIL`.

### Real-Time Multiplayer

Invite another player by link or in-app invite and play board games head-to-head, with live turn sync through Convex. Lobbies support 2+ players depending on the game.

### Player Challenges

Finish any game and dare another player to beat your score — they get a challenge card on their home screen, play the same stage, and the result posts to the family feed.

### Rankings with Time Windows

All-time, monthly, and weekly boards (fresh races every week), a top-3 podium, rank tiers from Starter to Diamond, and a sticky "your rank" footer.

### Audio Tracks (8 tracks, Web Audio API)

Lo-fi beats, focus pads, nature sounds, and meditation tones — all synthesized in-browser, no audio files needed.

### Social & Chat

- Activity feed with score announcements
- Real-time chat with @mention support
- Emoji reactions and reply-to-message quoting
- GIF search (GIPHY, proxied through Convex, G-rated only)
- Kid mode: activity feed only — enforced on the server, not just hidden in the UI
- Player-to-player challenges

### Accounts & Security

- Netflix-style profile picker with 45+ unique avatars
- 6-digit PIN per player, stored hashed (never in plaintext)
- Server-issued session tokens authenticate every write
- Login lockout after repeated failed attempts

### Why Play? (Gaming & the Brain)

A curated, static reading page at `/why-play` covering what research says about games vs. doom-scrolling — working memory, planning, calm, and social play. Deliberately static (no third-party feed): sources are named, claims are hedged, and nothing external loads on a kids' site.

### Issue Reporting & Admin

- In-app "report a problem" and "request a game" flows (with Linear issue creation via webhook)
- Admin panel (secret-gated) for player management: PIN resets, account merges, activity overview

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Backend | Convex (real-time database, auth, functions) |
| Deployment | Cloudflare Pages (frontend), Convex Cloud (backend) |
| 3D | three.js + @react-three/fiber (lazy-loaded only for 3D games) |
| Icons | Lucide React |
| Audio | Web Audio API (programmatic synthesis) |
| Testing | Vitest, Testing Library, convex-test |

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm
- A Convex account ([convex.dev](https://convex.dev))

### Setup

```bash
# Clone
git clone https://github.com/antonio59/noodle-quest
cd noodle-quest

# Install
pnpm install

# Start Convex backend (creates .env.local with VITE_CONVEX_URL)
pnpm run convex:dev

# In another terminal, start frontend
pnpm run dev
```

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_CONVEX_URL` | frontend | Convex deployment URL (written to `.env.local` by `convex dev`) |
| `ADMIN_SECRET` | Convex | Gates admin panel functions (must be ≥24 characters) |
| `WEBHOOK_SECRET` | Convex | Required for `/webhook/report` (fail-closed if unset) |
| `LINEAR_API_KEY` | Convex | Creates Linear issues from error reports (optional) |
| `LINEAR_WEBHOOK_SECRET` | Convex | Required for `/webhook/linear` (fail-closed if unset) |
| `GIPHY_API_KEY` | Convex | Chat GIF search, proxied server-side (G-rated only). Picker says "not switched on" if unset |
| `ANTHROPIC_API_KEY` | Convex | "Write clues for me" in the puzzle maker (20 requests/player/hour). Optional — clues can be written by hand |
| `RESEND_API_KEY`, `ADMIN_EMAIL` | Convex | Signup-approval emails and the Sunday family recap email. Optional — skipped if unset |

### Scripts

```bash
pnpm run dev             # Start Vite dev server
pnpm run build           # Typecheck + production build
pnpm run preview         # Preview production build
pnpm run lint            # ESLint
pnpm run typecheck       # tsc for app + convex
pnpm test                # Vitest (UI + Convex backend tests)
pnpm run test:coverage   # Tests with V8 coverage report
pnpm run convex:dev      # Start Convex dev
pnpm run convex:deploy   # Deploy Convex functions to production
pnpm run art:build       # Regenerate public/art/*.svg game tiles
pnpm run og:build        # Regenerate public/og.jpg link preview (macOS: uses QuickLook)
```

## Database Schema (Convex)

| Table | Purpose |
|-------|---------|
| `players` | User accounts (name, hashed PIN, avatar, lockout state) |
| `sessions` | Auth session tokens issued at signup/login |
| `scores` | Individual game score records |
| `progress` | Per-player per-game stage progress |
| `feed` | Chat messages and activity posts |
| `reactions` | Emoji reactions on feed posts |
| `challenges` | Player-to-player score challenges |
| `favorites` | Favorited games |
| `playlists` | Custom audio track playlists |
| `multiplayer_invites` | Invite codes for live games |
| `multiplayer_sessions` | Live game state (roster, board, turns) |
| `game_requests` | Player-submitted game ideas |
| `reports` | Error/issue reports (with optional Linear linkage) |
| `family_puzzles` | Crosswords / word searches built from the family's own words |
| `puzzle_times` | Best solve time per player per puzzle (weekly or family-made) |
| `rate_limits` | Fixed-window counters for paid endpoints (AI clues) |

## Project Structure

```
src/
  screens/       # Main views (home, game-hub, play, feed, leaderboard, profile, auth, admin, invite, why-play, puzzles/)
  games/         # 56 game components; board/word games split into tested logic + UI
  components/    # Shared UI (NavBar, GameArt, pass-and-play/, puzzles/, family week card, modals)
  hooks/         # useAudioEngine (Web Audio API), usePageVisibility
  contexts/      # AuthContext (login/signup/session token)
  lib/           # game registry/manifest, pass & play helpers, fixed puzzles, puzzle engine
  tracks/        # Audio track definitions
  types.ts       # Shared TypeScript interfaces

convex/
  schema.ts      # Database schema (16 tables)
  auth.ts        # Sign up, login (hashed PINs, lockout), sessions, admin tools
  model/auth.ts  # PIN hashing + session helpers
  games.ts       # Score saving, leaderboard queries
  feed.ts        # Activity feed, chat, reactions
  challenges.ts  # Player challenges
  multiplayer.ts # Invites, lobbies, live sessions
  reports.ts     # Issue reports and game requests
  webhooks.ts    # HTTP endpoint for bot-reported errors (Linear integration)
  gifs.ts        # GIPHY search proxy (G-rated, kid mode denied)
  puzzles.ts     # Family puzzles, weekly puzzle times + boards
  clues.ts       # AI clue suggestions (Anthropic SDK, rate-limited)
  recap.ts       # Weekly family recap query + email
  crons.ts       # Sunday recap schedule
  migrations.ts  # One-time data migrations

scripts/
  game-art/      # SVG game tile generator (pnpm art:build)
  og/            # Link-preview image builder (pnpm og:build)
  jev-audit/     # Content audit tooling

tests/
  convex/        # Backend tests (convex-test)
```

## Testing

```bash
pnpm test
```

Covers UI contract tests for every game (mount, score, lifecycle), unit tests for all extracted game logic (board-game AIs, Scrabble scoring, cube state model, puzzle engine), and Convex backend tests (auth, sessions, scoring, challenges, multiplayer authorization, admin merge).

```bash
pnpm run test:e2e
```

Playwright smoke tests cover the public surface (app shell, PWA plumbing, dictionaries) and boot both 3D games with real WebGL via the unauthenticated `/qa/play/:gameId` route. All Convex traffic is blocked in E2E — CI never touches real data.

## Deployment

Hosted on **Cloudflare Pages** (git-connected, auto-deploys `main`). The build
deploys the Convex backend first, then the frontend, so the two stay in sync:

```
Build command:  npx convex deploy --cmd 'npm run build'
Output dir:     dist
```

SPA fallback and security headers live in `public/_redirects` and
`public/_headers`. Pages build env vars: `NODE_VERSION=22`,
`VITE_CONVEX_URL`, `CONVEX_DEPLOY_KEY` (secret).

Manual deploys:

```bash
pnpm run pages:deploy   # build + wrangler pages deploy dist
pnpm run convex:deploy  # backend only
pnpm run pages:dev      # local preview via wrangler pages dev
```

## License

Private — all rights reserved.
