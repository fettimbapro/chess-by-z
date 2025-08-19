import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("fetches puzzle by rating filter and respects exclude", async () => {
  const svc = new PuzzleService();
  const puzzles = [
    { id: "1", rating: 399, themes: "", openingTags: "" },
    { id: "2", rating: 399, themes: "", openingTags: "" },
  ];
  svc.loadCsv = async () => puzzles;

  const p1 = await svc.randomFiltered({
    difficultyMin: 399,
    difficultyMax: 399,
  });
  assert.equal(p1.rating, 399);

  const p2 = await svc.randomFiltered({
    difficultyMin: 399,
    difficultyMax: 399,
    excludeIds: [p1.id],
  });
  assert.equal(p2.rating, 399);
  assert.notEqual(p1.id, p2.id);
});
