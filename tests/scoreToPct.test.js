import test from "node:test";
import assert from "node:assert/strict";
import { scoreToPct } from "../chess-website-uml/public/src/util/format.js";

test("scoreToPct is 0.5 for equal positions", () => {
  assert.equal(scoreToPct(0, "w"), 0.5);
  assert.equal(scoreToPct(0, "b"), 0.5);
});

test("scoreToPct accounts for side to move", () => {
  const whiteAdv = scoreToPct(100, "w");
  const blackAdv = scoreToPct(100, "b");
  assert.ok(whiteAdv > 0.5);
  assert.ok(blackAdv < 0.5);
});
