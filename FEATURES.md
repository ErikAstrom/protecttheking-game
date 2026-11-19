# Features & Tasks

The shared to-do board for **humans and AI agents**. Anyone adds ideas here; agents pick them up and build them.
Several agents work at the same time. This file is how we avoid two of them building the same thing.

## How it works

### Adding a feature (anyone)
Add an entry at the bottom of **Open** using the template below. A rough one-liner is fine. Agents fill in details when they pick it up.

### Picking up a feature (agents)
1. `git pull` first, so you see the latest claims.
2. Choose an **Open** item that nobody has claimed. Prefer one whose likely files don't overlap the **Files** of items **In progress**.
3. **Claim it before writing any code.** Move the entry to **In progress** and set its status to
   `in progress — <agent or person>, <YYYY-MM-DD HH:MM>`, and fill in **Files** with the main files you expect to touch. Commit just that change (`Claim: <feature title>`) and push it right away.
4. If the push is rejected, `git pull --rebase`. If someone else claimed the same item in the meantime, they got it first. Undo your claim and pick another item.
5. Work on one claimed item at a time.

### While working
- Add short dated notes under **Notes**: decisions, which files you're touching, blockers, questions for humans.
- If you're blocked on a human decision, set the status to `blocked — <question>` and move on to something else.
- If a feature is bigger than expected, split it. Keep the part you're doing, and add the rest as new **Open** items.

### Finishing
- Move the entry to **Done**, set the status to `done — <date>` and mention the commit/PR in the notes.
- Update `AGENTS.md` if the feature changed game rules, structure or commands (as AGENTS.md requires anyway).

### Etiquette
- Don't rewrite or delete other people's entries. Add notes instead.
- A claim with no commits or notes for **24 hours** is stale. You may take it over, but add a note saying so.
- Humans can edit anything here: reprioritize, reword, or reject ideas (move rejected ones to **Done** with `status: rejected — <reason>`).

### Template

```markdown
### <Short feature title>
- **Status:** open
- **Requested by:** <name>
- **Description:** <what and why, as rough as you like>
- **Files:** <filled in by whoever claims it: main files they expect to touch>
- **Notes:**
```

---

## In progress

### Golden gun
- **Status:** in progress — Claude (Erik's session), 2026-11-19 14:10
- **Requested by:** Erik
- **Description:** A rare pickup that lets a non-king shoot 3 times. Shots can kill enemy players but never the king. A killed player respawns in their team's starting box after 3 seconds.
- **Files:** new `src/gun.ts`, `src/gun.test.ts`, `src/gunfx.ts`; hooks in `src/rules.ts` (item, player/state fields, tuning), `src/game.ts` (spawn, use item, death/respawn), `src/arena.tsx` + `src/penguin.ts` (drawing), `src/client.tsx` (HUD)
- **Notes:**
  - 2026-11-19 — Plan: shots go in the direction you last moved, stop at obstacles, pass through teammates, and are blocked (harmlessly) by kings. Rare: only appears on respawns, at a small chance, with at most one on the board.

### Random-exit teleporters and larger characters
- **Status:** in progress — Copilot, 2026-11-19 13:06
- **Requested by:** Playtest feedback
- **Description:** Show characters 25% larger and default to four teleporters with random exits.
- **Files:** `src/rules.ts`, `src/game.ts`, `src/arena.tsx`, `src/client.tsx`, portal test fixtures and a focused portal test file.

### Water holes in the ice
- **Status:** in progress — Claude (Erik's session), 2026-11-19 14:35 (starts after Golden gun lands, since it reuses its death/respawn)
- **Requested by:** Erik
- **Description:** Holes in the ice sheet where you fall into the water. Falling in kills you and you respawn in your starting box, like being shot.
- **Files:** new `src/holes.ts`, `src/holes.test.ts`; hooks in `src/game.ts`, `src/rules.ts`, `src/penguin.ts`/`src/arena.tsx` (drawing). Not `src/layout.ts` (that's "Open ice sheet layout").
- **Notes:**

### Open ice sheet layout
- **Status:** in progress — Claude (subagent), 2026-11-19 14:20
- **Requested by:** Erik
- **Description:** "Make walls bigger and units bigger but less walls. It should also resemble an ice sheet more, where some walls are present, but more open areas to slide around more."
- **Files:** new `src/icesheet.ts`, `src/icesheet.test.ts`; small hooks in `src/layout.ts` (pick layout by world), `src/game.ts` (1–2 lines in the constructor/`startRound`), `src/rules.ts` (default board size only); `AGENTS.md`
- **Notes:**
  - 2026-11-19 — Plan: Penguin world gets its own layout of a few chunky, mirrored icebergs/ice blocks with wide open lanes; Castle keeps the dense walls. Units/walls get bigger on screen by shrinking the default board (everything scales with `914 / size`), not by changing drawing code, so this stacks with the "larger characters" claim above without touching `arena.tsx`. Water holes are NOT part of this (main session builds them in `src/holes.ts`).

## Open

_No open items._

## Done

### Penguin world
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** Theme the game as penguins on a block of ice in the ocean. Penguins try to catch the other team's king penguin. Movement is properly slippery: running builds momentum in the direction you run, and turning makes you drift and drag before the new direction takes over.
- **Files:** new `src/ice.ts`, `src/ice.test.ts`, `src/penguin.ts`; hooks in `src/game.ts`, `src/arena.tsx`, `src/client.tsx`, `src/rules.ts`
- **Notes:**
  - 2026-11-19 — Plan: a new "Ice" movement mode built on Smooth's fractional movement, with acceleration and low friction so turns drift. Physics goes in a new `src/ice.ts`, with small hooks in `game.ts`. Penguin/ocean visuals go in a new `src/penguin.ts`, with small hooks in `arena.tsx`. This should stay compatible with "Denser randomized arenas" (I won't touch wall generation).
  - 2026-11-19 — Done in `Add Penguin world with slippery Ice movement`. Ice and Penguin world are the new defaults; Smooth, Classic and Castle arena remain selectable. 9 new tests in `src/ice.test.ts` (acceleration, drift, skid, glide, wall bounce, slush drag). Verified in a browser 2v2 against bots: live server shows ~0.3 tiles in the first 0.2 s, ~2.5 tiles of sideways drift after a turn, ~8 tiles of glide after release. Castle arena re-checked. Tune feel via `ICE` in `src/rules.ts`.

### Big-screen match viewer
- **Status:** done — 2026-11-19
- **Requested by:** Host playtest
- **Description:** Add a read-only host display for the live match without taking a player slot.
- **Notes:** Completed in `Add read-only big-screen match viewer`. Verified a live four-player round and server-side rejection of spectator commands. Phone controllers are out of scope.

### Ice / drag movement effects
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** Surfaces or effects that change how movement feels. For example, ice where players slide and keep momentum, or drag/mud that slows and "sticks". Should work with both Classic and Smooth movement modes.
- **Notes:**
  - 2026-11-19 — Claude: Global ice sliding is covered by **Penguin world**. Per-tile terrain (ice patches, mud/drag) is still open here.
  - 2026-11-19 — Copilot: Completed in `Add local ice and quicksand terrain`. Classic ice changes step speed only; Smooth gets wider turns. Cobblestone is decorative. Verified both modes in game tests and the terrain display in a four-client browser start.

### Denser randomized arenas
- **Status:** done — 2026-11-19
- **Requested by:** Erik / playtest feedback
- **Description:** Replace the sketch-based layout with more walls and varied solid obstacles.
- **Notes:** 2026-11-19 — Completed in `Generate denser mirrored arenas`. Added bent walls, crates, and pillars with clear spawns and connecting lanes. Verified both movement modes and a four-client browser start.
