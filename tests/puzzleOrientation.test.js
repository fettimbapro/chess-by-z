import test from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleUI } from '../chess-website-uml/public/src/puzzles/PuzzleUI.js';

// Ensure puzzle loading orients board for side to move

test('loadConvertedPuzzle flips orientation', async () => {
  const game = {
    fenStr: '',
    load(f){ this.fenStr = f; },
    fen(){ return this.fenStr; },
    turn(){ return this.fenStr.split(' ')[1]; },
    moveSan(){ return {}; },
    undo(){}
  };
  let oriented = null;
  const app = { sideSel: { value: 'white' } };
  const ui = {
    clearArrow() {},
    resizeOverlay() {},
    drawArrowUci() {},
    setOrientation(side){ oriented = side; }
  };
  const puzzles = new PuzzleUI({
    game,
    ui,
    service: {},
    dom: {},
    onStateChanged: () => ui.setOrientation(app.sideSel.value),
    onMove: () => {},
    onPuzzleLoad: (turn) => { app.sideSel.value = (turn === 'w') ? 'white' : 'black'; }
  });

  await puzzles.loadConvertedPuzzle({ puzzle:{ id:'p1', fen:'8/8/8/8/8/8/8/k6K b - - 0 1', moves:'a1b1' } });
  assert.equal(app.sideSel.value, 'black');
  assert.equal(oriented, 'black');
});
