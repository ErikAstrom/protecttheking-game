# Protect the King — Agent Spec

This is the main spec for AI coding agents (Claude, Codex, Copilot, Cursor, etc.) working in this repo.
**Read this file fully before writing code.**

> Status: early draft, and a **living document**. Sections marked `TBD` are simply not decided yet — they are not blockers.

## 0. This spec is yours to evolve

Agents are free — and expected — to edit this file as the project develops.

- **`TBD` means "open", not "forbidden".** If a task needs a decision that isn't made yet, make a sensible choice, implement it, and write it into the relevant section here (replacing the `TBD`).
- **Keep the spec and the code in sync.** When you add a system, change the structure, pick a library, or add run/test commands, update this file in the same change.
- **Record notable decisions** with a one-line reason in the Decision log (section 9) so later agents understand why.
- **Don't silently reverse** a decision that's already written down. If you think one is wrong, change it deliberately and note why in the Decision log.
- **Several agents and people work here at once.** Pull the latest changes before editing, keep edits to the sections you touched, and don't overwrite other people's additions.
- Only ask a human when a choice is genuinely hard to undo (e.g. switching engine/language, deleting major features) or when the spec and the code contradict each other in a way you can't resolve.

---

## 1. Project overview

**Protect the King** is a two-team party game about defending your own king while hunting the other.

- Genre: Top-down 2D team chase/tag game.
- Platform: Desktop browser on the same LAN as a designated Node host.
- Big-screen spectators use `/watch`. The read-only display shows the lobby, arena, score, timer, and replays without joining a team. The server rejects game commands on its spectator WebSocket.
- Rounds: 90 seconds by default, configurable.
- Theme: **Penguin world** by default — penguin teams on a floating ice floe in the ocean, hunting the other team's king penguin. **Castle arena** is still selectable. Worlds are visual only; rules are identical.

## 2. Game design

### Core loop
Teams spawn in opposite corners and see the entire arena. Each team rotates its king each round; the other players can guard or hunt. Each round generates a rotationally symmetric layout with bent stone walls, crates, and pillars, leaving clear spawns and connecting lanes. All obstacles are solid in both movement modes. Opening pickups form randomized mirrored pairs (with one extra if the count is odd). Collected pickups return independently in random open positions after 2.5–6.5 seconds. In Penguin world the same layout is drawn as an ice floe: walls are ice blocks, crates are snow-capped blocks, pillars are ice spires, ice terrain is black ice and quicksand is slush.

### Win / lose conditions
- Capture occurs on collision between a king and an enemy non-king, before any pushback. King versus king blocks without scoring.
- A capture gives the winner one point. On timeout, the host can choose a draw or compare the number of opposing non-kings within five tiles of each king; equal counts draw.
- First team to the configured point target wins. The lobby host starts rounds.
- After a capture, players get an instant replay of up to three seconds of server-recorded action at 75% speed, with start and impact cues when sound is enabled. Playback is local and skippable and doesn't hold up the next round. Timeouts don't generate replays.

### Entities
| Entity | Role | Notes |
|---|---|---|
| King | Evade opponents | Cannot push, capture, or collect items. Space activates a four-second sprint followed by a ten-second recharge. |
| Non-king | Guard or hunt | Body-blocks players; an active strength boost lets the mover push enemy non-kings up to two free tiles, without chain pushes. |
| Pickups | Modify movement or collision | Collect into an unlimited per-round FIFO queue. Strength lasts six seconds and refreshes without stacking. Speed lasts four seconds. A deployed slow trap expires after 20 seconds or on first enemy contact, slowing them for three seconds. |
| Portals | Connect distant points | 0–4 pairs, one by default. Randomized each round. Anyone can enter from either end; an occupied exit prevents travel. |
| Terrain | Offers risky shortcuts | Mirrored patches of quicksand slow movement; ice speeds it up and widens Smooth turns only. Grass and cobblestone are neutral. In Ice movement, terrain changes top speed, so slush drags a sliding penguin down gradually rather than stopping it. |

### Controls
WASD or arrows. Classic moves cardinally one tile at a time; Smooth uses fractional world coordinates, normalized diagonals, speed-dependent turn inertia, and circular unit collisions with no chain pushes. Releasing movement plants the player. **Ice** (the default) uses Smooth's fractional coordinates and collisions but adds momentum: holding a direction accelerates to top speed over about half a second, sideways momentum fades slowly after a turn (drift), reversing skids through zero, releasing keys glides to a stop over a couple of seconds, and sliding into a wall bounces back slightly. Physics live in `src/ice.ts` and tuning in `ICE` in `src/rules.ts`. On a blocked unit collision, only the mover recoils. Capture and successful strength pushes take priority. Space activates the oldest held item, or the king's sprint.

### Progression & difficulty
Default match: Ice movement in Penguin world, 4v4, first to 3, 14 on-board pickups. Lobby settings control team size, timer, arena dimensions, points to win, timeout rule, movement mode (Ice, Smooth or Classic), world (Penguin world or Castle arena), and on-board pickup count (0–40). A disconnect ends the current match and returns remaining players to the lobby.

## 3. Tech stack

- Language: TypeScript.
- Engine / framework: React lobby and scoreboard, tilted Canvas 2D board, opt-in Web Audio music and cues.
- Build tooling: TypeScript type-checking and Vite browser build.
- Hosting: Node.js serves the build and owns match state; `ws` handles same-origin WebSockets. In-memory, single lobby, trusted LAN only.

Do not add new dependencies without approval. Prefer the standard library and the chosen engine's built-ins.

## 4. Repo structure

- `FEATURES.md` — shared feature/task board: ideas, claims, progress notes, done list.
- `src/game.ts` — authoritative simulation; rule tests in `src/game.test.ts`.
- `src/layout.ts` — procedural obstacle layouts and terrain patches.
- `src/rules.ts` — shared protocol, state types, and gameplay tuning.
- `src/ice.ts` — pure Ice-movement physics (momentum, drift, glide, wall bounce); tests in `src/ice.test.ts`.
- `src/server.ts` — HTTP host and WebSocket command handling.
- `src/client.tsx`, `src/style.css` — lobby, input, inventory HUD, and scoreboard.
- `src/arena.tsx`, `src/audio.ts` — tilted board and procedural music and sound effects.
- `src/penguin.ts` — Penguin world drawing (ocean, ice floe, ice blocks, penguins), called from `arena.tsx`.

## 5. Coding conventions

- Keep game logic (rules, state) separate from rendering and input.
- Small, focused files and functions; clear names over comments.
- No magic numbers for gameplay values — put tuning values (speeds, health, damage, spawn rates) in one config/constants location.
- Formatting and linting: `TBD` (follow whatever tooling is configured once it exists).
- Movement checks: use `isFractional(movement)` for anything about fractional coordinates (true for Smooth **and** Ice). Compare `movement === 'smooth'` only for behavior that really is Smooth-only.
- Worlds/themes are visual only. Put world-specific drawing in its own module (like `src/penguin.ts`) with a small hook in `arena.tsx`, never game rules.

## 6. How agents should work here

1. Read this file, then the relevant code, before changing anything.
   - **Feature work goes through [`FEATURES.md`](FEATURES.md).** Pull, claim an open item (commit and push the claim) *before* coding, leave notes while you work, and move it to Done when finished. Follow the rules at the top of that file so concurrent agents don't build the same thing. If you're asked to build something that isn't listed, add it and claim it first.
2. Make the smallest change that solves the task. No drive-by refactors.
3. Run `npm run check` (tests + type-check + build) before every push, then `npm start` for the LAN host.
4. Never commit secrets, API keys, or large binary assets without approval.
5. If you make a design decision that isn't covered here, write it into this file in the same change (see section 0).
6. Commit messages: short imperative summary line, e.g. `Add enemy spawn timer`.

## 6b. Working in parallel with other agents

Many people prompt agents in this repo at the same time, all pushing to `main`. To keep that smooth:

- **Pull before you start and before every push:** `git pull --rebase`. Expect other agents' commits to land while you work.
- **Claim first, then code** (see `FEATURES.md`). When you claim, list the main files you expect to touch, so others can avoid them or coordinate.
- **Prefer new files over editing busy ones.** Put a new system in its own module and add a small hook in the shared file (`game.ts`, `arena.tsx`, `client.tsx`), instead of rewriting large blocks.
- **Keep diffs small and focused.** No re-formatting, re-ordering or renaming of code you aren't changing; it creates conflicts for everyone else.
- **Put new tests in their own test file** (e.g. `src/<feature>.test.ts`) rather than appending to `src/game.test.ts`.
- **Resolving conflicts:** keep both sides' intent, never just "take mine". Then re-run `npm run check`. If you can't tell what the other change intended, read its commit message and FEATURES.md notes, and ask a human if it's still unclear.
- **Push in small, working steps.** Never push failing tests or a broken build to `main`, and never force-push `main`.
- **Settings and shared types:** when you add a field to `Settings` or `State`, update `DEFAULT_SETTINGS`, `readSettings` and the lobby form in the same commit, so other agents' lobbies keep working.

## 7. Definition of done

- The feature works when the game is run, not just in theory.
- Its entry in `FEATURES.md` is moved to Done with a short note.
- Tests (once they exist) pass.
- This spec is updated if behavior, structure, or commands changed.

## 8. Open questions

- Art style and asset sources?

Agents: resolve these as the work requires, move the answer into the right section, and remove the question here.

## 9. Decision log

Newest first. One line each: date — decision — why.

- 2026-11-19 — Make Penguin world with Ice movement the default and keep Castle/Smooth/Classic selectable — the owner wants a slippery penguin game, and the other modes stay useful for playtest comparison.
- 2026-11-19 — Give the big-screen viewer a read-only connection so observing never consumes a player slot or grants lobby controls.
- 2026-11-19 — Add local ice and quicksand without changing Classic steering or requiring players to cross a hazardous surface.
- 2026-11-19 — Replace the fixed sketch layout with randomized mirrored obstacles and clear lanes so chases offer different routes each round.
- 2026-11-19 — Track features in a shared FEATURES.md with push-to-claim — so concurrent agents don't duplicate work.
- 2026-11-19 — Give Smooth turns more inertia at higher speed, but stop on key release so players can still plant themselves at chokepoints.
- 2026-11-19 — Add numbered portal pairs and mover-only recoil so portals create shortcuts without weakening stationary bodyguards; give kings a rechargeable sprint instead of pickups.
- 2026-11-19 — Record capture replays on the host so all players can see the same lead-up without affecting scoring or round transitions.
- 2026-11-19 — Keep Classic alongside Smooth for playtest comparison; use an unlimited FIFO queue and placed traps so pickups reward timing as well as movement.
- 2026-11-19 — Start with a fixed wall layout and host-authoritative LAN play to tune the capture and push loop before adding procedural walls.
- 2026-11-19 — This spec is a living document that agents may edit — so work isn't blocked on undecided `TBD`s.
