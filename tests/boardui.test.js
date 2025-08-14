import test from 'node:test';
import assert from 'node:assert/strict';

// helper to create a barebones square element
function makeSquare() {
  return {
    dataset: { square: '' },
    innerHTML: '',
    classList: { add() {}, remove() {} },
    removeAttribute() {},
    setAttribute() {},
    querySelector() { return null; },
    style: {}
  };
}

test('setOrientation updates square dataset for black view', async () => {
  globalThis.document = {
    getElementById() { return null; },
    createElement() {
      return {
        setAttribute() {},
        appendChild() {},
        style: {},
        textContent: '',
        id: ''
      };
    },
    head: { appendChild() {} }
  };

  const { BoardUI } = await import('../chess-website-uml/public/src/ui/BoardUI.js');

  const files = ['a','b','c','d','e','f','g','h'];
  const squares = [];
  for (let r = 8; r >= 1; r--) {
    for (let f = 0; f < 8; f++) {
      const el = makeSquare();
      el.dataset.square = `${files[f]}${r}`; // initial white orientation
      squares.push(el);
    }
  }

  const boardEl = {
    querySelectorAll(sel) { return sel === '.sq' ? squares : []; },
    style: { setProperty() {} },
    clientWidth: 400,
    clientHeight: 400,
    appendChild() {},
    querySelector() { return null; }
  };

  const ui = Object.create(BoardUI.prototype);
  ui.boardEl = boardEl;
  ui._pos = {};
  ui.resizeOverlayViewBox = () => {};
  ui.orientation = 'white';

  // Render initial orientation then flip
  ui.renderPosition();
  ui.setOrientation('black');

  assert.equal(squares[0].dataset.square, 'h1');
});
