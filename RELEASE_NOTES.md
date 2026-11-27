# Release Notes — Noodle Quest

## 1.3.2 — 27 November 2026

UNO at the table now deals everyone in.

- Pass one phone or tablet around for UNO with 2, 3, or 4 people. Skip, Reverse, and Draw cards follow the seats, and the "Pass to…" curtain still hides the next hand
- Online UNO is still a game for two

---

## 1.3.1 — 27 October 2026

A behind-the-scenes safety update; nothing changes in how you play.

- Invite links now approve one new signup without locking anyone else out, and online board-game moves (Connect Four and Chess) are checked by the server
- Game history, the family feed and reports are tightened so each person only sees what they should, and anonymous signups are rate-limited
- Challenge scores are worked out from saved results, so they can't be faked
- Security and dependency updates, including Node.js 22.23.4 and the build and test tools

---

## 1.3 — 25 September 2026

Our biggest family-night update yet: pass one tablet around the sofa for nine classic board games, solve or build family puzzles together, play Tetris and 2048, and look back on the week every Sunday.

### 🛋️ Pass & Play on one device

Nine board games — **Checkers, Chess, Connect Four, Ludo, Scrabble, Score Four, Snakes & Ladders, Tic-Tac-Toe, and UNO** — now work for 2–4 people sharing one screen. Pick seats from the family (or add a guest), keep a running tally across rematches, and let the turn curtain hide hands between turns in UNO and Scrabble so nobody peeks. When you finish, you can optionally share the result to the family feed without affecting anyone's stars or rankings.

### 🧩 Puzzle Corner & family-made puzzles

- **This week's family puzzle** — a fresh crossword or word search every Monday, with the exact same grid for everyone and a family times board
- **Make your own puzzles** — type 4–15 of your own words (holidays, pets, spelling lists) to turn into a crossword or word search, with optional AI-drafted clues you can edit

### 🎮 Two new games & fresh artwork

- **Tetris** and **2048** join the lineup with touch-friendly and keyboard controls
- All **56 games** now have their own illustrated tiles across the app, plus a crisp link preview when you share Noodle Quest
- A new **Why Play?** page explains what research says about active games versus doom-scrolling

### 📅 Weekly family recap

A rolling 7-day **This week in the family** card on Home highlights games played, stars earned, star of the week, most-played game, challenge results, and the weekly puzzle leader — with an optional Sunday summary email.

### ✨ Fixes & polish

- **GIF search is back** in family chat (always G-rated, and off in kid mode)
- Solo wins now always save in Ludo, Snakes & Ladders, Scrabble, Connect Four, Score Four, and Bingo
- UNO no longer deals duplicate cards on the first solo round, and Score Four's two bead colours are now clearly distinct
- Word Search grids fit cleanly on phones, Story Builder and Routine Roadmap give fair partial credit for interchangeable steps, and dozens of map, word-list, and clue quirks were tidied up

### 🔐 Under the hood

- New signups without an invite link wait for owner approval; kid mode and online board-game rules are checked more tightly on the server
- Better keyboard and screen-reader accessibility across game boards and cards

---

## 1.2 — 13 September 2026

A mobile-polish pass: three new games, a chat that stops scrolling away from you, and breathing exercises that tell you the pattern before you start.

### 🎮 Three new games

- **Word Guess** — a Wordle-style daily-brain workout using the UK word list, with an on-screen keyboard
- **Minesweeper** — the classic, rebuilt for thumbs: a Flag/Dig toggle means no fiddly long-presses, and your first tap is always safe
- **Mole Mash** — whack-a-mole with golden bonus moles and stink-bomb decoys you should *not* hit

### 💬 Chat that stays put

Reading back through history while people keep chatting? The feed no longer rips you to the bottom — a "new messages" pill floats down instead, and you tap it when you're ready. Messages from the same person now split into separate bubbles after a 5-minute gap, and the chat box no longer triggers iOS's annoying auto-zoom.

### 🧘 Breathe & Tracks upgrades

- Every breathing card now shows its actual pattern (**In 4s · Hold 7s · Out 8s**) and what it's good for before you begin, with a gently pulsing icon
- The music player gains a **volume slider** that remembers your setting and a **sleep timer** (15/30/60 minutes) that fades out on its own — plus BPM badges on lo-fi tracks

### 📱 Better on phones

- Game cards line up properly — stars and Play buttons sit level across every row
- Memory Match no longer overflows small screens at higher stages
- Quick Math's timer pauses when you switch apps instead of silently expiring

### 🔐 Under the hood

- Moved hosting to **Cloudflare Pages** — same URL, faster edge delivery
- Removed a report-email endpoint that was never wired up

---

## 1.1 — 13 September 2026

This update makes online games trustworthy and more fun: the server now referees every online board game, Cube Twist becomes a real race, and there's a fresh new look.

### 🎲 Online games you can trust

Dice rolls, card deals, tile bags, and Bingo calls now come from the server — not the players' devices. That means nobody can peek at your UNO hand or Scrabble rack, nudge the dice, or call Bingo on a card that doesn't win. If your opponent leaves mid-game, you get the win instead of being stuck on a frozen board.

### 🏁 Cube Twist is a real race now

Online Cube Twist used to make players take turns twisting *one shared* cube — you'd undo each other's progress forever. Now the server scrambles one cube and gives everyone their own copy: first to solve wins, no waiting.

### 🧠 Friendlier opponents

On easy and medium, the Connect Four and Score Four AIs still make mistakes so kids can win — but they'll never again blunder into an instant loss on the very next move.

### ✨ Also in this update

- A new teal-and-gold look for the whole app, plus an optional light theme and a kid mode
- Online multiplayer for Score Four, 4-player Ludo, and tighter mobile layouts
- Player names ignore capitalization, so "Alice" and "alice" can't be two different people
- Sudoku got a full repair — most of its puzzles were unwinnable before; all 15 are now verified solvable
- Bookworm keeps your score if the clock runs out, Connect Lines never starts already solved, and Tic-Tac-Toe's AI can no longer sneak a move onto a reset board
- 400+ automated tests, including a full suite that plays out the online rules to catch cheats

### 🔐 Under the hood

- Every online move is checked server-side — out-of-turn plays, impossible moves, and made-up wins are rejected
- Sign-in and session handling hardened; expired sessions are cleaned up automatically
- Dependency security advisories cleared

## Upgrade Notes (1.1)

- Run `npx convex deploy` to roll out the server-authoritative game rules — older clients can't play online games against the new server until they update.

---

## 1.0 — Overview

Noodle Quest 1.0 is the "whole family" release: two brand-new 3D games, board-game opponents that actually think ahead, score challenges you can send to each other, fairer difficulty, real Scrabble dictionaries, and a friendlier look — on top of properly secured accounts.

## What's New

### 🧊 Two 3D games

- **Cube Twist** — a 3×3×3 twisty cube. Swipe across a face to turn that layer, drag the background to spin the whole cube, or use the U/D/L/R/F/B keys. Stages scale the scramble from 3 twists up to 20.
- **Score Four** — Connect Four in three dimensions. Drop beads onto a 4×4×4 grid of rods and line up four in *any* direction — 76 winning lines including space diagonals. Spin the board to spot them.

Both load their 3D engine only when opened, and devices without WebGL get a friendly fallback.

### ⚔️ Player challenges

Finish any game, tap **Challenge a player**, and send your score to beat. They'll see a challenge card on their home screen; when they play, the result — glory or heartbreak — posts to the family feed.

### 🧠 Smarter opponents, fairer difficulty

Every board-game AI was rebuilt with real search: Connect Four and Checkers look many moves ahead, Chess evaluates position (not just material), and hard Tic-Tac-Toe is now genuinely unbeatable. Difficulty follows the stage you're *playing* — so replaying stage 1 is always a gentle warm-up — and every stage shows its difficulty up front.

### 📖 Scrabble, fixed and expanded

The bug where valid words were rejected is fixed (the game silently used a tiny built-in word list while the real dictionary downloaded). You can now also choose your lexicon: **UK & International (SOWPODS)** or **US & Canada (TWL)** — and online games use the host's choice so everyone plays by the same words.

### 🏆 Rankings that stay interesting

Weekly and monthly boards alongside all-time, so there's a fresh race every Monday.

### 🔊 Game feel

Synthesized sound effects and vibration (toggle in your profile), confetti on wins, and per-move sounds in the board games.

### 🎲 Ludo, actually multiplayer

Online Ludo was advertised but never wired up — it now works, bonus rolls and captures included. The board math was also fixed (blue's route was accidentally half the length of red's).

### ♿ Accessibility

Keyboard play on chess and checkers boards, screen-reader announcements of game state, labelled grids, accessible dialogs, reduced-motion support, and pinch-zoom restored.

### 🔐 Under the hood

- PINs are hashed, sessions are token-based, and logins lock after repeated failures
- Installable as an app (PWA) with offline-aware caching
- 594 unit tests + Playwright end-to-end smoke tests on every PR
- Deploy previews finally work — every PR gets a playable URL

## Upgrade Notes (1.0)

- Everyone is signed out once by the session upgrade — just log in again.
- If not yet done, run `npx convex run migrations:hashAllPins` against production and set `ADMIN_SECRET` in the Convex environment.

---

*For the OpenClaw bot-integration release notes that previously lived here, see the `[0.9.0]` section of CHANGELOG.md.*
