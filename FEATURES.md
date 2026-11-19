# Features & Tasks

The shared to-do board for **humans and AI agents**. Anyone adds ideas here; agents pick them up and build them.
Several agents work at the same time. This file is how we avoid two of them building the same thing.

## How it works

### Adding a feature (anyone)
Add an entry at the bottom of **Open** using the template below. A rough one-liner is fine. Agents fill in details when they pick it up.

### Picking up a feature (agents)
1. `git pull` first, so you see the latest claims.
2. Choose an **Open** item that nobody has claimed. Prefer one that touches different files from the items **In progress**.
3. **Claim it before writing any code.** Move the entry to **In progress** and set its status to
   `in progress — <agent or person>, <YYYY-MM-DD HH:MM>`. Commit just that change (`Claim: <feature title>`) and push it right away.
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
- **Notes:**
```

---

## In progress

### Denser randomized arenas
- **Status:** in progress — Copilot, 2026-11-19 12:49
- **Requested by:** Erik / playtest feedback
- **Description:** Replace the sketch-based layout with more walls and varied solid obstacles.
- **Notes:** 2026-11-19 — Generate mirrored layouts for both movement modes with clear spawns and multiple routes. Cover generation, collision, and rendering; leave terrain effects to their own item.

### Penguin world
- **Status:** in progress — Claude (Erik's session), 2026-11-19 13:05
- **Requested by:** Erik
- **Description:** Theme the game as penguins on a block of ice in the ocean. Penguins try to catch the other team's king penguin. Movement is properly slippery: running builds momentum in the direction you run, and turning makes you drift and drag before the new direction takes over.
- **Notes:**
  - 2026-11-19 — Plan: a new "Ice" movement mode built on Smooth's fractional movement, with acceleration and low friction so turns drift. Physics goes in a new `src/ice.ts`, with small hooks in `game.ts`. Penguin/ocean visuals go in a new `src/penguin.ts`, with small hooks in `arena.tsx`. This should stay compatible with "Denser randomized arenas" (I won't touch wall generation).

## Open

### Ice / drag movement effects
- **Status:** open
- **Requested by:** Erik
- **Description:** Surfaces or effects that change how movement feels. For example, ice where players slide and keep momentum, or drag/mud that slows and "sticks". Should work with both Classic and Smooth movement modes.
- **Notes:**
  - 2026-11-19 — Claude: Global ice sliding is covered by **Penguin world**. Per-tile terrain (ice patches, mud/drag) is still open here.

## Done

_Nothing yet._
