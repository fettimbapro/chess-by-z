import test from "node:test";
import assert from "node:assert/strict";
import { detectOpening } from "../src/engine/Openings.js";

test("detectOpening recognizes King's Gambit Accepted", () => {
  const san = ["e4", "e5", "f4", "exf4"];
  const fen = "rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3";
  const opening = detectOpening({ san, fen });
  assert.deepEqual(opening, {
    eco: "C30",
    name: "King's Gambit Accepted",
  });
});
