# Changelog

All notable changes to **Noodle Quest v2** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-13

### Added
- **Kid mode and light theme** profile preferences
- **Online multiplayer for Score Four and Cube Twist**; Ludo expanded to
  4 seats
- Teal/gold "kitchen table" brand refresh (replacing the purple shell)
- Bug-report email notification function (Netlify)

### Changed
- **Multiplayer is now server-authoritative**: dice rolls (Ludo, Snakes &
  Ladders), card deals (UNO), tile bags and racks (Scrabble), cube
  scrambles (Cube Twist), and the Bingo call clock are all generated and
  validated on the server
- **Cube Twist online is a race**: each seat solves its own copy of a
  shared server scramble; first to finish wins (previously players
  alternated single twists on one shared cube)
- The server derives the next turn for every online game; client-sent
  turn fields are ignored and normalized
- Board-game AIs: easy/medium "blunders" can no longer hand over an
  immediate loss (they already always took an immediate win)
- Player names are case-insensitive (no `Alice`/`alice` collisions)
- Mobile chrome tightened on Games, Rankings, and the app shell
- Move payloads capped at 64KB, stored move history at 400 entries,
  sessions at 8 players

### Fixed
- **Scrabble online**: the guest played from the host's rack, and stray
  syncs could reset the board
- Host seeding no longer consumes the first turn
- **Finished sessions now end locally** — an opponent resigning or
  disconnecting no longer leaves the other player stuck in-game
- Flaky Connect Four / Score Four tactic tests (root cause: the blunder
  path could pick a mate-in-1 move — see Changed)
- Stale `.claude/` worktree copies could run in the Vitest suite —
  excluded from test discovery
- **Sudoku: 14 of 15 puzzles were broken** — unsolvable, ambiguous, or
  stored solutions contradicting the givens; all replaced with verified
  unique-solution puzzles, completion now validates grid rules instead of
  string-matching, and all 15 puzzles are reachable via play rotation
- **Bookworm reported score 0 on timeout** — the countdown interval
  captured a stale score; the earned score is now reported
- **Connect Lines could start already solved** — symmetric tiles let the
  random scramble land solved; a rotatable tile is now nudged when so
- **Tic-Tac-Toe: AI could move onto a reset board** — clicking Play Again
  during the AI's 400ms think let its move land on the fresh board; the
  timer is now tracked and cancelled
- Intermittent vitest `EnvironmentTeardownError` — jsdom canvas calls and
  React/three.js console noise raced worker shutdown; canvas is stubbed
  and known noise is filtered in test setup

### Security
- **Server-side move validation for every online board game** — illegal
  transitions, forged winner claims, and out-of-turn plays are rejected
- **Hidden information stays hidden**: UNO opponent hands, Scrabble
  opponent racks, and the tile pool are stripped from client views;
  clients can only submit their own cards
- Bingo win claims must include the card and marks; the server replays
  the claimed line against its own call list
- UNO draw/pass and penalty draws handled server-side; Scrabble rack
  refills drawn server-side from the hidden pool
- Invite codes are cryptographically random; a direct invite can only be
  declined by the invitee or retracted by the host
- Admin/report/score/multiplayer integrity gaps closed; admin and
  webhook secrets compared in constant time
- Expired sessions are cleaned up on login; resigning finishes the
  session server-side so it can't be griefed open
- Dependency lockfile advisories cleared (OSV Scanner)

## [1.0.0] - 2026-07-03

The "whole family" release: hardened accounts, genuinely competitive game
AIs, two fully 3D games, async player challenges, and a design refresh.

### Added
- **3D games (three.js)**: Cube Twist — a 3×3×3 twisty cube with
  swipe-to-turn, keyboard moves, undo, and stage-scaled scrambles — and
  Score Four — Connect Four in 3D (4×4×4, 76 winning lines) with a
  minimax AI. Lazy-loaded chunk; WebGL fallback screens for old devices
- **Player challenges**: dare anyone to beat your score from any end
  screen; challenge cards on the home screen; results post to the feed
- **Ranking time windows**: all-time / month / week boards
- **Scrabble dictionaries**: choice of UK & International (SOWPODS) or
  US & Canada (TWL06); host's pick syncs to online opponents
- **Ludo online multiplayer** (was advertised but never wired)
- **Keyboard play** on the checkers and chess boards (arrow-key cursor,
  Enter to move) and a tap-friendly Ludo piece chooser
- **Game feel**: synthesized sound effects + haptics behind a profile
  toggle, confetti win celebrations, per-move sounds in board games
- **Continue playing** card and pending-challenge cards on home
- **Unread chat dot** in the nav, chat day separators
- **PWA**: installable manifest, icons, offline-aware service worker
- **E2E smoke tests** (Playwright, desktop + mobile) incl. WebGL boots
  via the new unauthenticated `/qa/play/:gameId` QA route
- Display typography (Baloo 2), landing-page game marquee, ranking
  skeleton loaders, taken-avatar indicators at sign-up

### Changed
- **Every board-game AI rebuilt** with real search: Connect Four
  (negamax depth 7), Checkers (multi-jump-aware depth 6), Chess
  (piece-square tables + capture extensions), Tic-Tac-Toe (perfect play
  on hard), Ludo (threat-aware heuristics honoring difficulty)
- **Difficulty follows the stage being played** (1-3 easy, 4-9 medium,
  10+ hard) with visible badges — replaying stage 1 is easy again
- Scrabble gates play behind the dictionary download (the old silent
  fallback list was why valid words got rejected)
- Scrabble dictionary trimmed to playable 2-10 letter words
- README rewritten to match the actual app

### Fixed
- **Ludo board math**: the track has 48 squares but movement used
  52-square arithmetic — blue's route was half of red's
- Netlify deploy previews (previously failed on every PR)
- Accessibility: aria-live game status, labelled grids, named boards,
  restored pinch-zoom, prefers-reduced-motion support, accessible modals

### Security
- PINs hashed (never stored in plaintext, client or server)
- Server-issued session tokens on every player-acting mutation
- Login lockout after repeated failures; admin endpoints hardened
- Dependency advisories cleared (esbuild, ws, vite, react-router)

## [0.9.0] - 2026-06-10

### Added
- **OpenClaw Bot Integration** - Automated error detection, reporting, and resolution workflow
- **Error Reporting System** - New `reports` table in Convex schema for tracking bugs with status lifecycle (open → investigating → resolved → dismissed)
- **Linear Issue Integration** - Automatic Linear issue creation when errors are reported, with project assignment support
- **Webhook Endpoints** - Two new Convex HTTP routes:
  - `POST /webhook/report` - Accept error reports from bots or external monitoring
  - `POST /webhook/linear` - Optional webhook for Linear status sync
- **Client-Side Error Reporting Hook** - `useReportError()` for easy integration in React components
- **Global Error Boundary Setup** - `setupGlobalErrorReporting()` to catch unhandled errors and promise rejections
- **Report Mutations**:
  - `reports.createReport` - Create new error reports with deduplication via errorId
  - `reports.resolveReport` - Mark reports as resolved with optional resolution notes
  - `reports.updateReportWithLinear` - Link reports to Linear issues
- **Report Queries**:
  - `reports.getOpenReports` - List all open reports
  - `reports.getGameReports` - Filter reports by game
  - `reports.getRecentReports` - Get recent reports with pagination
- **Feed Integration** - Automatic user notifications when their reported bugs are fixed
- **Environment Variable Support**:
  - `LINEAR_API_KEY` - Linear API key for issue creation
  - `LINEAR_TEAM_ID` - Linear team to create issues in
  - `LINEAR_PROJECT_ID` - (Optional) Linear project to assign issues to

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Webhook endpoints validate required fields before processing
- Linear API calls fail gracefully without breaking the report flow

---

## [0.1.0] - 2026-04-03

### Added
- Initial release of Noodle Quest v2
- 27 brain and board games (Copy Cat, Focus Frenzy, Tic-Tac-Toe, Chess, etc.)
- Convex backend with real-time database
- Player profiles with PIN-based auth
- Activity feed with chat and reactions
- Player-to-player challenges
- Custom audio synthesis (no external audio files)
- Lo-fi beats and meditation sounds
- Netlify deployment setup
