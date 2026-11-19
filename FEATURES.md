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

### Choose available power-ups
- **Status:** in progress — Claude (Erik's session), 2026-11-19 16:20
- **Requested by:** Erik
- **Description:** Lobby checkboxes for which power-ups can appear in a match (Strength, Speed, Slow trap, Vault, Sword, Golden gun). Only checked ones spawn.
- **Files:** `src/rules.ts` (Settings.items, defaults, readSettings), `src/game.ts` (pickup spawning), `src/client.tsx` (lobby checkboxes), new `src/items-setting.test.ts`.
- **Notes:**

## Open

### Wire golden gun and splash sounds
- **Status:** open (waiting on "Golden Gun sound cues")
- **Requested by:** Claude (follow-up to Golden gun / Water holes)
- **Description:** Once `GameAudio.cue('golden-gun-spawn' | 'golden-gun-pickup')` exist, play them from the client when a gun pickup appears / is collected (diff `state.pickups` and the player's inventory like the existing pickup cue). Also add and play cues for a shot (`state.shots` gains an entry) and a splash (`state.splashes` gains an entry).
- **Files:**
- **Notes:**

### HTTPS and secure WebSockets
- **Status:** open
- **Requested by:** Playtest feedback
- **Description:** Document how to host the game over HTTPS with a certificate trusted by players' phones, and support secure WebSockets (`wss://`) for gameplay and the viewer.
- **Notes:** LAN hosting should not require cloud deployment. Configure allowed HTTPS origins explicitly.

### Mobile controller page
- **Status:** open
- **Requested by:** Playtest feedback
- **Description:** Add a phone-friendly page for joining as a player and controlling movement and item use without rendering the arena. Use `/watch` as the shared big-screen display.
- **Notes:** Include a touch D-pad for movement and an action button for items and king sprint.

### Gyro and tilt controls
- **Status:** open
- **Requested by:** Playtest feedback
- **Description:** Let players steer by tilting their phones using browser device-orientation events, without installing a native app.
- **Notes:** Builds on the mobile controller page and trusted HTTPS. Include tap-to-enable sensor permission where required, neutral-position calibration, and a touch fallback if sensors are unavailable or permission is denied.

### Lobby access control
- **Status:** open
- **Requested by:** Playtest feedback
- **Description:** Let hosts make a lobby private. Players join with a display name and temporary room code instead of creating an account; host controls require a separate host session.
- **Notes:** Validate access server-side before sending private match snapshots, including to viewers, and rate-limit failed code attempts. Keep `/watch` read-only.

## Done

### Sword
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** Common pickup. Space draws the sword for 10 seconds; while it's out, it chops down any enemy non-king you touch or get within reach of, any number of times. Chopped players respawn in their starting box after 3 seconds (same as being shot). It does nothing to kings (normal capture rules still apply).
- **Files:** new `src/sword.ts`, `src/sword.test.ts`, `src/swordfx.ts`; small hooks in `src/rules.ts` (item, tuning, player field, slash state), `src/game.ts` (activate, chop check), `src/arena.tsx` (draw hook), `src/client.tsx` (HUD).
- **Notes:**
  - 2026-11-19 — Done in `Add sword`. 10 tests in `src/sword.test.ts` (reach rules, kings/teammates/dead immune, common pickup, 10 s duration, contact chops both ways in Classic and Ice, unlimited chops, respawn in box, king capture unchanged). Browser-verified on a private port: Space draws the sword (HUD timer + ring), sliding into an enemy hunter chopped it in 0.7 s with a CHOP! slash.

### Match pickup count to players by default
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Default to one on-board pickup per player, with a fixed-count override.
- **Notes:** Implemented in `Default pickup count to the round roster`. The automatic count includes kings and bots.

### Action-hero bot names
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Give balancing bots original action-hero parody names with a visible bot marker.
- **Notes:** Implemented in `Give balancing bots action-hero parody names`.

### Random map rotation and asymmetric Rooms layouts
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add a random map option with no back-to-back repeats, and vary the shape and placement of Rooms & Corridors formations.
- **Notes:** Implemented in `Add random map rotation and vary room formations`. The active world is chosen by the host; Rooms groups can run across or down the board.

### Denser Rooms & Corridors layouts
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add more randomized rooms, distinct corridors, and connected raised routes.
- **Notes:** Implemented in `Add denser Rooms and Corridors layouts`. The standard board now has eight two-exit rooms, corridors at least three tiles wide, and a connected upper route with a third staircase near mid-map.

### Arena movement features
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add walkable icebergs, grippy rubble mounds, directional conveyors, and Space boost lanes.
- **Notes:** Implemented in `Add walkable movement features to each arena`. Places mirrored pairs clear of existing hazards and obstacles.

### Stronger and more frequent Space hazards
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Increase tilt strength, tilt odds, and black hole spawn frequency in Space only.
- **Notes:** Implemented in `Increase Space tilt and black hole frequency`. Default tilt odds rise from 50% to 80%, peak tilt is 50% stronger, and black-hole delays are 2–4 seconds.

### Raised walkway in Rooms & Corridors
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add a raised level with stairs and walk-off drops to Rooms & Corridors only.
- **Notes:** Implemented in `Add a raised walkway to Rooms and Corridors`. Uses normal controls in all three movement modes; the platform is solid underneath.

### Countdown music
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Play a rising melody and short beeps on 3–2–1, then a higher, longer beep with the GO fanfare. Plays for players and the live viewer when sound is enabled.
- **Notes:** Implemented in `Add countdown music and start beeps`.

### Arena layout and gravity tuning
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Randomize Rooms with wall segments at least five tiles long, add Space walls, strengthen gravity, and remove decorative crosses and player letters.
- **Notes:** Completed in `Randomize arena outlines and tune Space gravity`. All maps now roll both corner cuts independently.

### Space map with a black hole
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add a selectable Space arena where a temporary black hole appears at random and slowly pulls nearby players inward without eliminating anyone.
- **Files:** `src/space.ts`, `src/space-art.ts`, `src/space.test.ts`, and small game, client, and rendering hooks.
- **Notes:** Completed in `Add Space arena with a temporary black hole`. Verified pull and expiry in all movement modes and that players can steer away.

### Penguins vs. Orcas
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Use upright red penguins and belly-sliding blue orcas in every world. Movement and hitboxes are unchanged.
- **Notes:** Completed in `Use penguins and orcas in every world`. Verified both sprites in Penguin World, Castle Arena, Rooms & Corridors, and Space (with tilt and the black hole active together).

### Rooms & Corridors map
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add a selectable map with actual rooms, long walls, and wide doorways instead of scattered obstacles.
- **Files:** `src/rooms.ts`, `src/rooms.test.ts`, `src/game.ts`, `src/rules.ts`, `src/client.tsx`
- **Notes:** Completed in `Add Rooms and Corridors map`. Existing maps are unchanged.

### Golden Gun fanfare and king water loss
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Give the Golden Gun a bigger, distinct musical cue. If a king falls into water, immediately award the opposing team one point and end the round.
- **Files:** `src/audio.ts`, `src/audio.test.ts`, `src/game.ts`, `src/rules.ts`, `src/client.tsx`, `src/holes.test.ts`
- **Notes:** Completed in `Make Golden Gun fanfares bigger and score king falls`. Non-kings still respawn normally. A king's fall only ends the match when the point reaches the configured target.

### Shaped arenas, natural terrain, and sudden tilt
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Non-square arenas, irregular mirrored terrain, and a brief tilt event with directional speed changes and an opt-in musical cue.
- **Notes:** Completed in `Shape arenas and add a sudden tilt event`. Verified movement in all three modes and the direction announcement in the live viewer.
  - Follow-up: `Vary arena outlines and make tilt configurable` adds a new mirrored outline each round and configurable tilt odds and duration (50% and 20 seconds by default), with easing and no tilt in rounds that cannot fit it.

### Clear team badges
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Round red R and square blue B badges for all players, including kings, in both worlds.
- **Notes:** Completed in `Make player teams easier to see`. Verified both badges on kings in the live viewer. No gameplay or hitbox changes.

### Round start countdown
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Show a synchronized three-second countdown before every round on player screens and `/watch`. Freeze play until GO, then start the full round timer.
- **Notes:** Completed in `Count down before every round`. Verified the overlay and full clock in both browser views, plus first and subsequent rounds, blocked actions, and disconnect cleanup in game tests.

### Smart bots for uneven teams
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Give hosts an option to add bots to the smaller team without moving humans. Keep kings human and have bots guard or hunt using the normal game rules.
- **Files:** `src/bots.ts`, `src/bots.test.ts`, `src/rules.ts`, `src/game.ts`, `src/client.tsx`
- **Notes:** Completed in `Balance uneven teams with bots`. Verified in the browser that 3v2 starts as 3v3 with a human king and that the bot is removed on return to the lobby.

### Single item slot and Vault pickup
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Keep the held item when touching another pickup. Add a Vault item that skips one wall or player on the next eligible collision within five seconds of activation.
- **Files:** `src/game.ts`, `src/rules.ts`, `src/client.tsx`, `src/arena.tsx`, `src/vault.test.ts`
- **Notes:** Implemented in `Limit pickups to one slot and add Vault`. Verified all three movement modes, blocked and wet landings, expiry, king capture, and Golden Gun ammo.

### Water holes in the ice
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** Holes in the ice sheet where you fall into the water. Falling in kills you and you respawn in your starting box, like being shot.
- **Files:** new `src/holes.ts`, `src/holes.test.ts`; hooks in `src/game.ts`, `src/rules.ts`, `src/penguin.ts`/`src/arena.tsx` (drawing). Not `src/layout.ts` (that's "Open ice sheet layout").
- **Notes:**
  - 2026-11-19 — Done in `Add water holes to the ice sheet`. Mirrored hole pairs (3 on the 48 board; fits 200/200 generated ice sheets at sizes 32/48/64), Penguin world only. Falling in reuses the golden gun's out-of-play + respawn (3 s, starting box); kings drown and respawn too, no points. 7 tests in `src/holes.test.ts` (placement, Ice slide-in, Classic step-in, forgiving rim, kings, strength push into water, no pickups in water, none in Castle arena). Browser-verified: slid into a hole, SPLASH!, HUD countdown, respawned in red box.

### Visible size boost for Strength
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Make players visibly larger while Strength is active without changing hitboxes.
- **Notes:** Completed in `Show larger characters during Strength`. Browser check verified a 25% increase while active and a return to normal size on expiry.

### Open ice sheet layout
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** "Make walls bigger and units bigger but less walls. It should also resemble an ice sheet more, where some walls are present, but more open areas to slide around more."
- **Files:** new `src/icesheet.ts`, `src/icesheet.test.ts`; small hooks in `src/game.ts` (1–2 lines in the constructor/`startRound`), `src/rules.ts` (default board size only), `src/penguin.ts` (block tops); `AGENTS.md`
- **Notes:**
  - 2026-11-19 — Plan: Penguin world gets its own layout of a few chunky, mirrored icebergs/ice blocks with wide open lanes; Castle keeps the dense walls. Units/walls get bigger on screen by shrinking the default board (everything scales with `914 / size`), not by changing drawing code, so this stacks with the "larger characters" claim above without touching `arena.tsx`. Water holes are NOT part of this (main session builds them in `src/holes.ts`).
  - 2026-11-19 — "Bigger units" is covered by Copilot's "Random-exit teleporters and larger characters" (characters 1.25×); I didn't change penguin drawing or collision radius (`smoothRadius` stays 0.44).
  - 2026-11-19 — Done in `Add open ice sheet layout for Penguin world`. Penguin world now uses `generateIceSheet` (`src/icesheet.ts`): 3 mirrored pairs of 3–5-tile icebergs on the default board (~90 tiles vs ~125 for the castle layout at the same size, ~170 on the old 64 default), ≥5 tiles of ice between bergs, 3-tile edge lane and spawn clearance. Default board 64 → 48, so walls and penguins draw 1.33× bigger (stacks with Copilot's 1.25×). Wall blocks lost their per-tile highlight and are a bit taller so bergs read as single slabs. Castle arena keeps the dense walls; Classic/Smooth work with both. Open space for water holes: ~80% of tiles are ≥2 tiles from any ice (`openTiles(size, obstacles, 2, spawnMargin)` lists them). 4 tests in `src/icesheet.test.ts`. Checked both worlds with 4 bots on a local server in the /watch viewer.

### Golden gun
- **Status:** done — 2026-11-19
- **Requested by:** Erik
- **Description:** A rare pickup that lets a non-king shoot 3 times. Shots can kill enemy players but never the king. A killed player respawns in their team's starting box after 3 seconds.
- **Files:** new `src/gun.ts`, `src/gun.test.ts`, `src/gunfx.ts`; hooks in `src/rules.ts` (item, player/state fields, tuning), `src/game.ts` (spawn, use item, death/respawn), `src/arena.tsx` + `src/penguin.ts` (drawing), `src/client.tsx` (HUD)
- **Notes:**
  - 2026-11-19 — Plan: shots go in the direction you last moved, stop at obstacles, pass through teammates, and are blocked (harmlessly) by kings. Rare: only appears on respawns, at a small chance, with at most one on the board.
  - 2026-11-19 — Done in `Add golden gun with death and respawn`. 11 tests in `src/gun.test.ts` (hit rules, teammates, kings, walls/range, 3 shots then gone, facing, respawn in box for Classic and Ice, dead players can't act or count, rarity). Browser-verified 2v2: HUD shows ammo, held gun + aim line, tracer and SHOT! flash, victim vanishes and respawns in blue's box. Death/respawn is reusable for water holes. No sound yet (claimed separately as "Golden Gun sound cues").

### Golden Gun sound cues
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Add original retro spy-style cues for the Golden Gun spawning, being collected, and firing.
- **Files:** `src/audio.ts`, `src/audio.test.ts`, `src/client.tsx`
- **Notes:** Prepared in `Add original Golden Gun sound cues` and wired in `Play Golden Gun cues during live matches`. Spawn and firing are audible to sound-enabled players and spectators; pickup is only audible to the collector. No recordings are used.

### Random-exit teleporters and larger characters
- **Status:** done — 2026-11-19
- **Requested by:** Playtest feedback
- **Description:** Show characters 25% larger and default to four teleporters with random exits.
- **Notes:** Completed in `Randomize teleporter exits and enlarge characters`. Checked random clear exits in game tests and four teleporters and 1.25× drawing scale in a live match.

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
