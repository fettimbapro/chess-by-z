import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered respects excludeIds", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async () => [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 500, themes: "", openingTags: "" },
  ];
  const res = await svc.randomFiltered({
    difficultyMin: 400,
    difficultyMax: 800,
    excludeIds: ["1"],
  });
  assert.equal(res.id, "2");
});
