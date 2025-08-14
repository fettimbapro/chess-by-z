import test from 'node:test';
import assert from 'node:assert';
import { Clock } from './Clock.js';

test('clock flags and clears timer on timeout', async () => {
  const clock = new Clock();
  clock.base = 100;
  clock.white = 100;
  clock.black = 100;

  const flagged = await new Promise(resolve => {
    clock.onFlag = resolve;
    clock.start();
  });

  assert.strictEqual(flagged, 'w');
  assert.strictEqual(clock.timer, null);
});
