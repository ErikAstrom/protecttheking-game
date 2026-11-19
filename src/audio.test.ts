import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameAudio, newShotCount } from './audio.ts';
import type { Shot } from './rules.ts';

test('only new shot events make a sound, even when two shots share a timestamp', () => {
  const first: Shot = { from: { x: 1, y: 1 }, to: { x: 1, y: 5 }, team: 'red', at: 20, hitId: null, stoppedBy: 'range' };
  const second: Shot = { ...first, team: 'blue' };
  const third: Shot = { ...first, at: 25 };
  assert.equal(newShotCount([], [first]), 1);
  assert.equal(newShotCount([first], [{ ...first }]), 0);
  assert.equal(newShotCount([first], [first, second, third]), 2);
  assert.equal(newShotCount([first, second, third], [third]), 0);
});

class TestOscillator {
  type: OscillatorType = 'sine';
  frequency = { value: 0 };
  startAt = 0;
  stopAt = 0;
  connect(node: object) { return node; }
  start(at: number) { this.startAt = at; }
  stop(at: number) { this.stopAt = at; }
}

test('Golden Gun cues are distinct, bounded, and respect opt-in sound', async t => {
  const oscillators: TestOscillator[] = [];
  class TestAudioContext {
    state = 'suspended';
    currentTime = 10;
    destination = {};
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
    createOscillator() {
      const oscillator = new TestOscillator();
      oscillators.push(oscillator);
      return oscillator;
    }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
  }
  Object.defineProperty(globalThis, 'AudioContext', { value: TestAudioContext, configurable: true });
  t.after(() => Reflect.deleteProperty(globalThis, 'AudioContext'));
  const audio = new GameAudio();

  audio.cue('golden-gun-spawn');
  assert.equal(oscillators.length, 0, 'a cue must not schedule sound before opt-in');
  await audio.enable();

  function play(cue: Parameters<GameAudio['cue']>[0]) {
    audio.cue(cue);
    const voices = oscillators.splice(0);
    assert.ok(voices.length > 0);
    assert.ok(voices.every(voice => voice.startAt >= 10 && voice.stopAt > voice.startAt && voice.stopAt < 11));
    return voices;
  }
  const spawn = play('golden-gun-spawn');
  const pickup = play('golden-gun-pickup');
  const fire = play('golden-gun-fire');
  const regular = play('pickup');
  assert.ok(spawn.some(voice => voice.type === 'sawtooth' && voice.frequency.value < 250));
  assert.ok(pickup.some(voice => voice.type === 'square' && voice.frequency.value > 800));
  assert.notDeepEqual(pickup.map(voice => voice.frequency.value), regular.map(voice => voice.frequency.value));
  assert.ok(fire.some(voice => voice.type === 'sine' && voice.frequency.value < 80));

  await audio.mute();
  audio.cue('golden-gun-fire');
  assert.equal(oscillators.length, 0, 'a muted cue must not schedule sound');
});
