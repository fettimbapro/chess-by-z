import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

test("queued pre-move executes after opponent move", async () => {
  globalThis.document = {
    getElementById() {
      return null;
    },
    createElement() {
      return {
        setAttribute() {},
        appendChild() {},
        style: {},
        textContent: "",
        id: "",
      };
    },
    head: { appendChild() {} },
    querySelector() {
      return null;
    },
  };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const { App } = await import("../chess-website-uml/public/src/app/App.js");
  const app = Object.create(App.prototype);
  app.game = new Game();
  app.modeSel = { value: "play" };
  app.sideSel = { value: "white" };
  app.inReview = false;
  app.gameOver = false;
  app.preMove = null;
  app.clock = { onMoveApplied() {}, turn: "w", white: 0, black: 0, inc: 0 };
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

  app.game.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");

  const startPiece = app.getPieceAt("e2");
  assert.equal(startPiece?.type, "p");
  const targets = app.getLegalTargets("e2").sort();
  assert.deepEqual(targets, ["e3", "e4"]);

  const ok = app.onUserMove({ from: "e2", to: "e4" });
  assert.equal(ok, true);
  assert.deepEqual(app.preMove, { from: "e2", to: "e4", promotion: "q" });
  assert.equal(app.game.get("e2").type, "p");
  assert.equal(app.game.turn(), "b");

  app.game.moveUci("e7e5");
  app.applyPreMove();

  assert.equal(app.preMove, null);
  const piece = app.game.get("e4");
  assert.equal(piece.color, "w");
  assert.equal(app.game.get("e2"), null);
  assert.equal(app.game.turn(), "b");
});

test("queued pre-move can target own piece square for recapture", async () => {
  globalThis.document = {
    getElementById() {
      return null;
    },
    createElement() {
      return {
        setAttribute() {},
        appendChild() {},
        style: {},
        textContent: "",
        id: "",
      };
    },
    head: { appendChild() {} },
    querySelector() {
      return null;
    },
  };
  globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const { App } = await import("../chess-website-uml/public/src/app/App.js");
  const app = Object.create(App.prototype);
  app.game = new Game();
  app.modeSel = { value: "play" };
  app.sideSel = { value: "white" };
  app.inReview = false;
  app.gameOver = false;
  app.preMove = null;
  app.clock = { onMoveApplied() {}, turn: "w", white: 0, black: 0, inc: 0 };
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

  app.game.load("4k3/8/8/4p3/3P4/2Q5/8/4K3 b - - 0 1");

  const targets = app.getLegalTargets("c3").sort();
  assert.ok(targets.includes("d4"));

  const ok = app.onUserMove({ from: "c3", to: "d4" });
  assert.equal(ok, true);
  assert.deepEqual(app.preMove, { from: "c3", to: "d4", promotion: "q" });
  assert.equal(app.game.get("c3").type, "q");

  app.game.moveUci("e5d4");
  app.applyPreMove();

  assert.equal(app.preMove, null);
  const piece = app.game.get("d4");
  assert.equal(piece?.color, "w");
  assert.equal(piece?.type, "q");
  assert.equal(app.game.get("c3"), null);
});

test("premove can move pinned piece and cannot move opponent piece", () => {
  const game = new Game();
  game.load("4k3/4q3/8/8/8/8/8/K3R3 w - - 0 1");
  const preMoves = game.premoveLegalMovesFrom("e7", "b");
  assert.ok(preMoves.includes("d6"));
  assert.deepEqual(game.premoveLegalMovesFrom("e1", "b"), []);
});
