import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../chess-website-uml/public/src/util/Events.js';

test('listeners removed during emit do not skip remaining listeners', () => {
  const bus = new EventBus();
  const calls = [];
  let offA;
  const fnA = () => {
    calls.push('a');
    offA();
  };
  offA = bus.on('evt', fnA);
  bus.on('evt', () => {
    calls.push('b');
  });
  bus.emit('evt');
  bus.emit('evt');
  assert.deepStrictEqual(calls, ['a', 'b', 'b']);
});
