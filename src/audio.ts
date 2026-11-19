import type { Shot } from './rules.ts';

export type ReplayCue = 'replay-start' | 'replay-impact';
type StandardCue = 'pickup' | 'use' | 'trap' | 'round' | 'capture' | 'timeout' | 'king-drowned' | 'urgent' | ReplayCue;
type GoldenGunCue = 'golden-gun-spawn' | 'golden-gun-pickup' | 'golden-gun-fire';
type Cue = StandardCue | GoldenGunCue | 'board-tilt';

const CUES: Record<StandardCue, number[]> = {
  pickup: [72, 79, 84], use: [60, 67, 76], trap: [56, 49, 44],
  round: [55, 60, 67, 72], capture: [60, 64, 67, 76], timeout: [62, 57, 55], urgent: [72, 72],
  'king-drowned': [65, 56, 41],
  'replay-start': [55, 48, 41],
  'replay-impact': [38, 74],
};
type CueNote = [midi: number, delay: number, duration: number, volume: number, wave: OscillatorType];
const GOLDEN_GUN_CUES: Record<GoldenGunCue, CueNote[]> = {
  'golden-gun-spawn': [
    [35, 0, 0.42, 0.15, 'sine'], [47, 0, 0.24, 0.09, 'sawtooth'],
    [59, 0.14, 0.20, 0.11, 'sawtooth'], [62, 0.33, 0.20, 0.12, 'sawtooth'],
    [65, 0.52, 0.31, 0.12, 'sawtooth'], [38, 0.52, 0.32, 0.14, 'sine'],
    [62, 0.82, 0.15, 0.10, 'sawtooth'], [57, 0.97, 0.16, 0.10, 'sawtooth'],
    [35, 1.16, 0.88, 0.18, 'sine'], [47, 1.16, 0.72, 0.08, 'sawtooth'],
    [62, 1.16, 0.78, 0.08, 'triangle'], [66, 1.16, 0.78, 0.08, 'sawtooth'],
    [71, 1.16, 0.84, 0.10, 'sawtooth'], [95, 1.16, 0.58, 0.04, 'sine'],
  ],
  'golden-gun-pickup': [
    [85, 0, 0.05, 0.045, 'square'],
    [47, 0.05, 0.23, 0.13, 'sine'], [66, 0.05, 0.17, 0.09, 'sawtooth'],
    [71, 0.17, 0.18, 0.10, 'sawtooth'], [74, 0.30, 0.24, 0.10, 'sawtooth'],
    [47, 0.52, 0.58, 0.14, 'sine'], [66, 0.52, 0.47, 0.08, 'triangle'],
    [74, 0.52, 0.47, 0.08, 'triangle'], [83, 0.52, 0.56, 0.09, 'sawtooth'],
    [95, 0.52, 0.44, 0.045, 'sine'],
  ],
  'golden-gun-fire': [
    [35, 0, 0.10, 0.12, 'sine'],
    [45, 0, 0.065, 0.075, 'sawtooth'],
    [90, 0, 0.045, 0.065, 'square'],
    [73, 0.038, 0.12, 0.04, 'triangle'],
    [88, 0.07, 0.15, 0.024, 'sine'],
  ],
};
const TUNE = [60, 67, 69, 67, 64, 67, 62, 67, 60, 64, 67, 72, 69, 64, 62, 67,
  57, 64, 67, 64, 60, 64, 62, 64, 55, 62, 65, 67, 65, 62, 59, 62];
const BASS = [48, 48, 45, 43];
const MUSIC_LEVEL = 0.42;
const FANFARE_MUSIC_LEVEL = 0.09;

export function newShotCount(previous: readonly Shot[], current: readonly Shot[]): number {
  // Tracers persist across snapshots, and multiple shots can share a timestamp.
  const remaining = new Map<number, number>();
  for (const { at } of previous) remaining.set(at, (remaining.get(at) ?? 0) + 1);
  let count = 0;
  for (const { at } of current) {
    const seen = remaining.get(at) ?? 0;
    if (seen) remaining.set(at, seen - 1);
    else count++;
  }
  return count;
}

export class GameAudio {
  private readonly context = new AudioContext();
  private readonly music = this.context.createGain();
  private timer: number | undefined;

  constructor() {
    this.music.gain.value = MUSIC_LEVEL;
    this.music.connect(this.context.destination);
  }

  async enable() {
    await this.context.resume();
  }

  async mute() {
    this.stopMusic();
    await this.context.suspend();
  }

  close() {
    this.stopMusic();
    void this.context.close().catch(error => console.error('Could not close game audio:', error));
  }

  setMusic(playing: boolean) {
    if (!playing) { this.stopMusic(); return; }
    if (this.timer !== undefined || this.context.state !== 'running') return;
    let index = 0;
    const beat = 0.25;
    let next = this.context.currentTime + 0.06;
    this.music.gain.setTargetAtTime(MUSIC_LEVEL, this.context.currentTime, 0.025);
    const schedule = () => {
      if (next < this.context.currentTime) next = this.context.currentTime + 0.06;
      while (next < this.context.currentTime + 0.16) {
        this.note(TUNE[index % TUNE.length] ?? 60, next, 0.18, 0.075, 'triangle', this.music);
        if (index % 4 === 0) this.note(BASS[Math.floor(index / 8) % BASS.length] ?? 48, next, 0.55, 0.1, 'sine', this.music);
        index++;
        next += beat;
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, 65);
  }

  cue(cue: Cue) {
    if (this.context.state !== 'running') return;
    const start = this.context.currentTime + 0.02;
    if (cue === 'board-tilt') {
      this.note(35, start, 1.15, 0.13, 'triangle', this.context.destination);
      this.note(41, start + 0.12, 0.95, 0.09, 'sawtooth', this.context.destination);
      this.note(34, start + 0.56, 1.1, 0.11, 'triangle', this.context.destination);
      return;
    }
    if (cue === 'golden-gun-spawn' || cue === 'golden-gun-pickup' || cue === 'golden-gun-fire') {
      const notes = GOLDEN_GUN_CUES[cue];
      if (cue !== 'golden-gun-fire' && this.timer !== undefined) {
        const end = Math.max(...notes.map(([, delay, duration]) => delay + duration));
        this.music.gain.cancelScheduledValues(start);
        this.music.gain.setTargetAtTime(FANFARE_MUSIC_LEVEL, start, 0.03);
        this.music.gain.setTargetAtTime(MUSIC_LEVEL, start + end, 0.11);
      }
      for (const [midi, delay, duration, volume, wave] of notes) {
        this.note(midi, start + delay, duration, volume, wave, this.context.destination);
      }
      return;
    }
    const impact = cue === 'replay-impact';
    CUES[cue].forEach((midi, index) =>
      this.note(midi, start + index * (impact ? 0.03 : 0.085),
        impact ? 0.24 : 0.16, 0.09, impact && index === 0 ? 'sine' : 'triangle', this.context.destination));
  }

  private stopMusic() {
    if (this.timer === undefined) return;
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.music.gain.cancelScheduledValues(this.context.currentTime);
    this.music.gain.setTargetAtTime(0, this.context.currentTime, 0.025);
  }

  private note(midi: number, start: number, duration: number, volume: number, type: OscillatorType, target: AudioNode) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(target);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
