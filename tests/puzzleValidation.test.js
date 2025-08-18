import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleUI } from "../chess-website-uml/public/src/puzzles/PuzzleUI.js";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

globalThis.window = { MoveFlash: { flash() {} } };

const PUZZLE = {
  id: "test",
  fen: "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  solutionSan: ["d5", "exd5"],
};

function createPuzzleUI() {
  const game = new Game();
  const ui = { clearArrow() {}, drawArrowUci() {} };
  const puzzles = new PuzzleUI({
    game,
    ui,
    service: {},
    dom: {},
    onStateChanged: () => {},
    onMove: () => {},
  });
  puzzles.current = { ...PUZZLE };
  puzzles.autoplayFirst = true;
  puzzles.index = 0;
  puzzles.applyCurrent();
  return { puzzles, game };
}

test("handleUserMove accepts correct moves and advances puzzle", () => {
  const { puzzles, game } = createPuzzleUI();
  const mv = game.move({ from: "e4", to: "d5" });
  assert.ok(mv);
  const res = puzzles.handleUserMove(mv);
  assert.equal(res, true);
  assert.equal(puzzles.index, 2); // both moves played
});

test("handleUserMove rejects incorrect moves and reverts position", () => {
  const { puzzles, game } = createPuzzleUI();
  const startFen = game.fen();
  const mv = game.move({ from: "c2", to: "c3" }); // c3 is wrong
  assert.ok(mv);
  const res = puzzles.handleUserMove(mv);
  assert.equal(res, false);
  assert.equal(puzzles.index, 1);
  assert.equal(game.fen(), startFen);
});
