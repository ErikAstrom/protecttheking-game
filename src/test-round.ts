import assert from 'node:assert/strict';
import type { Game } from './game.ts';
import { TUNING } from './rules.ts';

export function startActiveRound(game: Game, liveAt: number, command: 'start' | 'next' = 'start'): void {
  assert.equal(game[command](liveAt - TUNING.roundCountdownMs), undefined);
  game.tick(liveAt);
}
