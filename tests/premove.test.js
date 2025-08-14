import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../chess-website-uml/public/src/core/Game.js';

test('queued pre-move executes after opponent move', async () => {
  globalThis.document = {
    getElementById() { return null; },
    createElement() {
      return { setAttribute() {}, appendChild() {}, style: {}, textContent: '', id: '' };
    },
    head: { appendChild() {} },
    querySelector() { return null; }
  };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const { App } = await import('../chess-website-uml/public/src/app/App.js');
  const app = Object.create(App.prototype);
  app.game = new Game();
  app.modeSel = { value: 'play' };
  app.sideSel = { value: 'white' };
  app.inReview = false;
  app.gameOver = false;
  app.preMove = null;
  app.clock = { onMoveApplied() {}, turn: 'w', white: 0, black: 0, inc: 0 };
  app.clockPanel = { startIfNotRunning() {} };
  app.ui = { clearArrow() {} };
  app.playMoveSound = () => {};
  app.syncBoard = () => {};
  app.refreshAll = () => {};
  app.maybeCelebrate = () => {};
  app.checkGameOver = () => {};
  app.requestAnalysis = () => {};
  app.maybeEngineMove = () => {};
  app.applyPreMove = App.prototype.applyPreMove.bind(app);
  app.onUserMove = App.prototype.onUserMove.bind(app);
  app.getPieceAt = App.prototype.getPieceAt.bind(app);
  app.getLegalTargets = App.prototype.getLegalTargets.bind(app);

  app.game.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');

  const startPiece = app.getPieceAt('e2');
  assert.equal(startPiece?.type, 'p');
  const targets = app.getLegalTargets('e2').sort();
  assert.deepEqual(targets, ['e3', 'e4']);

  const ok = app.onUserMove({ from: 'e2', to: 'e4' });
  assert.equal(ok, true);
  assert.deepEqual(app.preMove, { from: 'e2', to: 'e4', promotion: 'q' });
  assert.equal(app.game.get('e2').type, 'p');
  assert.equal(app.game.turn(), 'b');

  app.game.moveUci('e7e5');
  app.applyPreMove();

  assert.equal(app.preMove, null);
  const piece = app.game.get('e4');
  assert.equal(piece.color, 'w');
  assert.equal(app.game.get('e2'), null);
  assert.equal(app.game.turn(), 'b');
});

test('queued pre-move can be canceled', async () => {
  globalThis.document = {
    getElementById() { return null; },
    createElement() {
      return { setAttribute() {}, appendChild() {}, style: {}, textContent: '', id: '' };
    },
    head: { appendChild() {} },
    querySelector() { return null; }
  };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const { App } = await import('../chess-website-uml/public/src/app/App.js');
  const app = Object.create(App.prototype);
  app.game = new Game();
  app.modeSel = { value: 'play' };
  app.sideSel = { value: 'white' };
  app.inReview = false;
  app.gameOver = false;
  app.preMove = null;
  app.clock = { onMoveApplied() {}, turn: 'w', white: 0, black: 0, inc: 0 };
  app.clockPanel = { startIfNotRunning() {} };
  app.ui = { clearArrow() {} };
  app.onUserMove = App.prototype.onUserMove.bind(app);
  app.cancelPreMove = App.prototype.cancelPreMove.bind(app);
  app.getPieceAt = App.prototype.getPieceAt.bind(app);
  app.getLegalTargets = App.prototype.getLegalTargets.bind(app);

  app.game.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');

  const ok = app.onUserMove({ from: 'e2', to: 'e4' });
  assert.equal(ok, true);
  assert.notEqual(app.preMove, null);

  const canceled = app.cancelPreMove();
  assert.equal(canceled, true);
  assert.equal(app.preMove, null);
});

test('recently queued pre-move survives click from drop', async () => {
  globalThis.document = {
    getElementById() { return null; },
    createElement() { return { setAttribute() {}, appendChild() {}, style: {}, id: '', textContent: '' }; },
    head: { appendChild() {} }
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const { BoardUI } = await import('../chess-website-uml/public/src/ui/BoardUI.js');
  let canceled = false;
  const boardEl = {
    _handler: null,
    addEventListener(type, fn) {
      if (type === 'click') this._handler = fn;
    },
  };
  const ui = Object.create(BoardUI.prototype);
  ui.boardEl = boardEl;
  ui.cancelPreMove = () => { canceled = true; return true; };
  ui.getPieceAt = () => null;
  ui.getLegalTargets = () => [];
  ui.selected = null;
  ui.dragTargets = new Set();
  ui.squareEl = () => ({ classList: { add(){}, remove(){} } });
  ui.clearSelectionDots = () => {};
  ui.markSelected = () => {};
  BoardUI.prototype.attachClick.call(ui);

  ui._preJustQueued = performance.now();
  boardEl._handler({ target: {} });
  assert.equal(canceled, false);

  await new Promise(r => setTimeout(r, 120));
  boardEl._handler({ target: { closest(){ return null; } } });
  assert.equal(canceled, true);
});
