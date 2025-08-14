import test from 'node:test';
import assert from 'node:assert/strict';

test('applyOrientation flips clock container', async () => {
  globalThis.document = {
    getElementById() { return null; },
    createElement() {
      return { setAttribute() {}, appendChild() {}, style: {}, textContent: '', id: '' };
    },
    head: { appendChild() {} }
  };
  globalThis.window = { addEventListener() {} };
  const { App } = await import('../chess-website-uml/public/src/app/App.js');

  let oriented = null;
  const app = Object.create(App.prototype);
  app.ui = { setOrientation: (side) => { oriented = side; } };
  app.sideSel = { value: 'white' };
  const cls = {
    _set: new Set(),
    add(c){ this._set.add(c); },
    remove(c){ this._set.delete(c); },
    toggle(c, force){ force ? this.add(c) : this.remove(c); },
    contains(c){ return this._set.has(c); }
  };
  app.boardArea = { classList: cls };

  app.applyOrientation();
  assert.equal(oriented, 'white');
  assert.ok(!cls.contains('flipped'));

  app.sideSel.value = 'black';
  app.applyOrientation();
  assert.equal(oriented, 'black');
  assert.ok(cls.contains('flipped'));
});

