import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
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

function mockAudio(t: TestContext) {
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
  return { audio: new GameAudio(), oscillators };
}

test('Golden Gun cues are distinct, bounded, and respect opt-in sound', async t => {
  const { audio, oscillators } = mockAudio(t);

  audio.cue('golden-gun-spawn');
  assert.equal(oscillators.length, 0, 'a cue must not schedule sound before opt-in');
  await audio.enable();

  function play(cue: Parameters<GameAudio['cue']>[0]) {
    audio.cue(cue);
    const voices = oscillators.splice(0);
    assert.ok(voices.length > 0);
    assert.ok(voices.every(voice => voice.startAt >= 10 && voice.stopAt > voice.startAt && voice.stopAt < 12.5));
    return voices;
  }
  const spawn = play('golden-gun-spawn');
  const pickup = play('golden-gun-pickup');
  const fire = play('golden-gun-fire');
  const regular = play('pickup');
  const duration = (voices: TestOscillator[]) => Math.max(...voices.map(voice => voice.stopAt)) - 10;
  assert.ok(duration(spawn) >= 1.8 && duration(pickup) >= 0.9 && duration(fire) < 0.3);
  assert.ok(spawn.some(voice => voice.type === 'sawtooth' && voice.frequency.value < 250));
  assert.ok(pickup.some(voice => voice.type === 'square' && voice.frequency.value > 800));
  assert.notDeepEqual(pickup.map(voice => voice.frequency.value), regular.map(voice => voice.frequency.value));
  assert.ok(fire.some(voice => voice.type === 'sine' && voice.frequency.value < 80));

  await audio.mute();
  audio.cue('golden-gun-fire');
  assert.equal(oscillators.length, 0, 'a muted cue must not schedule sound');
});

test('countdown music rises once per displayed number and resets for the next round', async t => {
  const { audio, oscillators } = mockAudio(t);
  audio.setCountdown(3);
  assert.equal(oscillators.length, 0);
  await audio.enable();

  const beeps = [3, 2, 1].map(beat => {
    audio.setCountdown(beat);
    const count = oscillators.length;
    audio.setCountdown(beat);
    assert.equal(oscillators.length, count, 'repeated snapshots must be silent');
    const notes = oscillators.splice(0);
    assert.ok(notes.length > 1, 'each beat is a musical phrase');
    assert.ok(notes.every(note => note.stopAt < 11), 'the phrase ends before the next beat');
    const beep = notes.find(note => note.type === 'sine' && note.stopAt - note.startAt < 0.1);
    assert.ok(beep, 'each beat has a short beep on top of the melody');
    return beep;
  });
  assert.ok(beeps[0]!.frequency.value < beeps[1]!.frequency.value &&
    beeps[1]!.frequency.value < beeps[2]!.frequency.value);

  audio.setCountdown(null);
  assert.equal(oscillators.length, 0, 'ending or cancelling the countdown adds no notes');
  audio.cue('round');
  const go = oscillators.splice(0).find(note => note.type === 'sine');
  assert.ok(go && go.frequency.value > beeps[2]!.frequency.value, 'GO has a higher beep');
  assert.ok(go.stopAt - go.startAt > beeps[2]!.stopAt - beeps[2]!.startAt, 'GO is held longer');
  audio.setCountdown(3);
  assert.ok(oscillators.length > 0);
});
