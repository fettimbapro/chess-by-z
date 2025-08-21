import test from "node:test";
import assert from "node:assert/strict";
import {
  formatScore,
  MATE_SCORE,
  INF_SCORE,
} from "../chess-website-uml/public/src/util/format.js";

test("formatScore handles centipawns", () => {
  assert.equal(formatScore(123), "1.23");
});

test("formatScore handles mate scores", () => {
  assert.equal(formatScore(MATE_SCORE - 1), "#1");
  assert.equal(formatScore(-MATE_SCORE + 1), "#-1");
});

test("formatScore handles infinite scores", () => {
  assert.equal(formatScore(INF_SCORE), "∞");
});
