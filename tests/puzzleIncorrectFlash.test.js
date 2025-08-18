import test from "node:test";
import assert from "node:assert/strict";

// Minimal stubs before importing PuzzleUI
globalThis.window = {
  MoveFlash: {
    calls: [],
    flash(opts) {
      this.calls.push(opts);
    },
  },
};
globalThis.document = {};

const { PuzzleUI } = await import(
  "../chess-website-uml/public/src/puzzles/PuzzleUI.js"
);

test("flashes red on incorrect move", () => {
  const game = {
    undoCalled: false,
    undo() {
      this.undoCalled = true;
    },
  };
  const ui = {};
  const service = { listOpenings: async () => ({}) };
  const pu = new PuzzleUI({ game, ui, service, dom: {} });
  pu.current = { solutionSan: ["e4"] };
  pu.index = 0;
  const res = pu.handleUserMove({ san: "d4" });
  assert.equal(res, false);
  assert.equal(game.undoCalled, true);
  assert.deepEqual(window.MoveFlash.calls, [{ color: "255,107,107" }]);
});
