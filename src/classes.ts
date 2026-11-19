// Class rules shared by the server simulation, the bots and the HUD. Pure functions only.
import { ABILITY, CLASSES, TUNING } from './rules.ts';
import type { Player } from './rules.ts';

type Unit = Pick<Player, 'king' | 'role'>;

/** Bodyguards are always strong enough to shove enemy non-kings (kings never push). */
export const hasStrength = (player: Unit) => !player.king && player.role === 'bodyguard';

export const isFrozen = (player: Pick<Player, 'frozenUntil'>, now: number) => player.frozenUntil > now;

export const isCloaked = (player: Pick<Player, 'invisibleUntil'>, now: number) => player.invisibleUntil > now;

/** Cooldown applied when the ability is used, measured from activation. */
export function abilityCooldownMs(player: Unit): number {
  if (player.king || player.role === 'hunter') return TUNING.speedMs + TUNING.kingRechargeMs;
  if (player.role === 'wizard') return ABILITY.wizardCooldownMs;
  if (player.role === 'strategist') return ABILITY.strategistCooldownMs;
  if (player.role === 'spy') return ABILITY.spyCooldownMs;
  return 0;
}

/** What the Space key does for this player right now, for the HUD and bots. */
export function abilityStatus(player: Pick<Player, 'king' | 'role' | 'abilityReadyAt' | 'sprintReadyAt' | 'paceUntil' | 'pace' |
  'vaultUntil' | 'invisibleUntil' | 'frozenUntil'>, now: number): { name: string; state: 'ready' | 'active' | 'cooldown' | 'passive' | 'frozen'; seconds: number } {
  const name = player.king ? 'King sprint' : CLASSES[player.role].ability;
  if (!player.king && CLASSES[player.role].passive) return { name, state: 'passive', seconds: 0 };
  if (isFrozen(player, now)) return { name, state: 'frozen', seconds: Math.ceil((player.frozenUntil - now) / 1000) };
  const activeUntil = player.king || player.role === 'hunter' ? (player.pace === 'speed' ? player.paceUntil : 0)
    : player.role === 'strategist' ? player.vaultUntil : player.role === 'spy' ? player.invisibleUntil : 0;
  if (activeUntil > now) return { name, state: 'active', seconds: Math.ceil((activeUntil - now) / 1000) };
  const readyAt = player.king ? player.sprintReadyAt : player.abilityReadyAt;
  if (readyAt > now) return { name, state: 'cooldown', seconds: Math.ceil((readyAt - now) / 1000) };
  return { name, state: 'ready', seconds: 0 };
}
