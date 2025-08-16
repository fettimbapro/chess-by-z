import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateMoveTime,
  estimateComplexity,
} from "../chess-website-uml/public/src/engine/TimeManager.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SIMPLE_FEN = "8/8/8/8/8/8/6k1/K7 w - - 0 1";

test("complex positions receive more time", () => {
  const high = estimateComplexity(START_FEN);
  const low = estimateComplexity(SIMPLE_FEN);
  assert.ok(high > low);
  const tHigh = allocateMoveTime({
    timeLeftMs: 60000,
    complexity: high,
    movesToGo: 30,
  });
  const tLow = allocateMoveTime({
    timeLeftMs: 60000,
    complexity: low,
    movesToGo: 30,
  });
  assert.ok(tHigh > tLow);
});

test("panic mode limits time usage when very low on clock", () => {
  const high = estimateComplexity(START_FEN);
  const t = allocateMoveTime({
    timeLeftMs: 500,
    complexity: high,
    movesToGo: 30,
  });
  assert.ok(t <= 250);
});

test("estimateComplexity handles invalid FEN", () => {
  assert.equal(estimateComplexity("invalid fen"), 0);
});
