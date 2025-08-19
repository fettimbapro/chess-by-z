import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered handles very large result sets", async () => {
  const svc = new PuzzleService();
  const big = [];
  for (let i = 0; i < 70000; i++) {
    big.push({ id: String(i), rating: 1500, themes: "", openingTags: "" });
  }
  svc.loadCsv = async () => big;
  const res = await svc.randomFiltered({
    difficultyMin: 0,
    difficultyMax: 2000,
  });
  assert.ok(res?.id);
});
