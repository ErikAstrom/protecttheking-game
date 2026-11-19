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
5. If you make a design decision that isn't covered here, write it into this file in the same change (see section 0).
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

Agents: resolve these as the work requires, move the answer into the right section, and remove the question here.

## 9. Decision log

Newest first. One line each: date — decision — why.

- 2026-11-19 — This spec is a living document that agents may edit — so work isn't blocked on undecided `TBD`s.
