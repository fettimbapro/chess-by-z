import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleUI } from "../chess-website-uml/public/src/ui/PuzzleUI.js";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

const PUZZLE = {
  id: "test",
  fen: "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  solutionSan: ["d5", "exd5"],
};

function createPuzzleUI() {
  const game = new Game();
  const highlights = new Map();
  const ui = {
    arrow: null,
    clearArrow() {
      this.arrow = null;
    },
    drawArrowUci(uci) {
      this.arrow = uci;
    },
    squareEl(sq) {
      if (!highlights.has(sq)) highlights.set(sq, new Set());
      const set = highlights.get(sq);
      return {
        classList: {
          add: (cls) => set.add(cls),
          remove: (cls) => set.delete(cls),
        },
      };
    },
  };
  const puzzles = new PuzzleUI({ game, ui, service: {}, dom: {} });
  puzzles.current = { ...PUZZLE };
  puzzles.index = 0;
  puzzles.applyCurrent();
  return { puzzles, ui, highlights };
}

test("hint highlights piece then shows move", () => {
  const { puzzles, ui, highlights } = createPuzzleUI();
  puzzles.hint();
  assert.equal(ui.arrow, null);
  assert.ok(highlights.get("d7")?.has("hl-from"));
  puzzles.hint();
  assert.equal(ui.arrow, "d7d5");
  assert.ok(!highlights.get("d7")?.has("hl-from"));
});
