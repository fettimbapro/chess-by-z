import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleUI } from "../chess-website-uml/public/src/puzzles/PuzzleUI.js";
import { Game } from "../chess-website-uml/public/src/core/Game.js";

test("prompts for new puzzle when solved and hides after load", async () => {
  global.alert = () => {};
  const game = new Game();
  let clickHandler;
  const puzzlePrompt = {
    style: {},
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
    dom: { puzzlePrompt },
  });
  puzzles.current = { solutionSan: ["e4"] };
  puzzles.index = 0;

  let loaded = false;
  const done = new Promise((resolve) => {
    puzzles.loadFilteredRandom = async () => {
      await puzzles.loadConvertedPuzzle({
        fen: "k7/8/8/8/8/8/8/K7 w - - 0 1",
        solution: [],
      });
      loaded = true;
      resolve();
    };
  });

  const mv = game.move({ from: "e2", to: "e4" });
  assert.ok(mv);
  const res = puzzles.handleUserMove(mv);
  assert.equal(res, true);
  assert.equal(puzzlePrompt.style.display, "flex");
  assert.match(puzzlePrompt.innerHTML, /Solved/);
  assert.match(puzzlePrompt.innerHTML, /button/);

  clickHandler();
  await done;
  assert.equal(loaded, true);
  assert.equal(puzzlePrompt.style.display, "none");
  assert.equal(puzzlePrompt.innerHTML, "");
});
