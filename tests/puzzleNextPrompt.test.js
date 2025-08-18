import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleUI } from "../chess-website-uml/public/src/puzzles/PuzzleUI.js";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

test("prompts for new puzzle when solved", () => {
  const game = new Game();
  let clickHandler;
  const puzzleStatus = {
    innerHTML: "",
    querySelector() {
      return {
        addEventListener(type, fn) {
          clickHandler = fn;
        },
      };
    },
  };
  const puzzles = new PuzzleUI({
    game,
    ui: { clearArrow() {}, drawArrowUci() {} },
    service: {},
    dom: { puzzleStatus },
  });
  puzzles.current = { solutionSan: ["e4"] };
  puzzles.index = 0;

  let nextCalled = false;
  puzzles.loadFilteredRandom = () => {
    nextCalled = true;
  };

  const mv = game.move({ from: "e2", to: "e4" });
  assert.ok(mv);
  const res = puzzles.handleUserMove(mv);
  assert.equal(res, true);
  assert.match(puzzleStatus.innerHTML, /Solved/);
  assert.match(puzzleStatus.innerHTML, /button/);

  clickHandler();
  assert.equal(nextCalled, true);
});
