# Protect the King — Agent Spec

This is the main spec for AI coding agents (Claude, Codex, Copilot, Cursor, etc.) working in this repo.
**Read this file fully before writing code.** If the code and this spec disagree, ask a human — don't guess.

> Status: early draft. Sections marked `TBD` still need decisions from the project owner.

---

## 1. Project overview

**Protect the King** is an original game where the player must keep the King alive.

- Pitch (one paragraph): `TBD`
- Genre: `TBD` (e.g. tower defense, action, strategy, puzzle)
- Platform: `TBD` (e.g. browser, desktop, mobile)
- Target session length: `TBD`

## 2. Game design

### Core loop
`TBD` — what the player does minute to minute.

### Win / lose conditions
- Lose: the King dies. (Details `TBD`: health, one-hit, timer?)
- Win: `TBD` (survive N waves, reach a goal, endless with score?)

### Entities
| Entity | Role | Notes |
|---|---|---|
| King | Must be protected | `TBD` (moves? stationary? abilities?) |
| Player / defenders | `TBD` | |
| Enemies | `TBD` | |

### Controls
`TBD`

### Progression & difficulty
`TBD` (waves, levels, upgrades, scoring)

## 3. Tech stack

- Language: `TBD`
- Engine / framework: `TBD`
- Build tooling: `TBD`
- Hosting / deploy: `TBD`

Do not add new dependencies without approval. Prefer the standard library and the chosen engine's built-ins.

## 4. Repo structure

`TBD` — fill in once the first code lands. Keep this section in sync with the actual layout.

## 5. Coding conventions

- Keep game logic (rules, state) separate from rendering and input.
- Small, focused files and functions; clear names over comments.
- No magic numbers for gameplay values — put tuning values (speeds, health, damage, spawn rates) in one config/constants location.
- Formatting and linting: `TBD` (follow whatever tooling is configured once it exists).

## 6. How agents should work here

1. Read this file, then the relevant code, before changing anything.
2. Make the smallest change that solves the task. No drive-by refactors.
3. Run the game and any tests before calling a task done. Commands: `TBD`.
4. Never commit secrets, API keys, or large binary assets without approval.
5. If you make a design decision that isn't covered here, add it to this file (or list it under Open questions) in the same change.
6. Commit messages: short imperative summary line, e.g. `Add enemy spawn timer`.

## 7. Definition of done

- The feature works when the game is run, not just in theory.
- Tests (once they exist) pass.
- This spec is updated if behavior, structure, or commands changed.

## 8. Open questions

- What genre and platform?
- What does the King do — stationary, or does it move?
- Single player only, or multiplayer?
- Art style and asset sources?
