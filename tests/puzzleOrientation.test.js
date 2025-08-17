import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleUI } from "../chess-website-uml/public/src/puzzles/PuzzleUI.js";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

// Ensure puzzle loading orients board for side to move

test("loadConvertedPuzzle flips orientation", async () => {
  const game = new Game();
  let oriented = null;
  const app = {
    sideSel: { value: "white" },
    gameOver: true,
    applyOrientation() {
      ui.setOrientation(this.sideSel.value);
    },
  };
  const ui = {
    clearArrow() {},
    resizeOverlay() {},
    drawArrowUci() {},
    setOrientation(side) {
      oriented = side;
    },
  };
  const puzzles = new PuzzleUI({
    game,
    ui,
    service: {},
    dom: {},
    onStateChanged: () => {},
    onMove: () => {},
    onPuzzleLoad: (turn) => {
      app.sideSel.value = turn === "w" ? "white" : "black";
      app.gameOver = false;
      app.applyOrientation();
    },
  });

  await puzzles.loadConvertedPuzzle({
    puzzle: { id: "p1", fen: "8/8/8/8/8/8/8/k6K b - - 0 1", moves: "a1b1" },
    autoplayFirst: true,
  });
  assert.equal(app.sideSel.value, "white");
  assert.equal(oriented, "white");
  assert.equal(app.gameOver, false);
});
