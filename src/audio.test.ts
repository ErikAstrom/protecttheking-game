import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameAudio } from './audio.ts';

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
  const regular = play('pickup');
  assert.ok(spawn.some(voice => voice.type === 'sawtooth' && voice.frequency.value < 250));
  assert.ok(pickup.some(voice => voice.type === 'square' && voice.frequency.value > 800));
  assert.notDeepEqual(pickup.map(voice => voice.frequency.value), regular.map(voice => voice.frequency.value));

  await audio.mute();
  audio.cue('golden-gun-pickup');
  assert.equal(oscillators.length, 0, 'a muted cue must not schedule sound');
});
