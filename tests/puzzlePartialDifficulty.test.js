import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered with minimum difficulty only", async () => {
  const svc = new PuzzleService();
  const puzzles = [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  svc.loadCsv = async () => puzzles;
  const res = await svc.randomFiltered({ difficultyMin: 600 });
  assert.equal(res.id, "2");
});

test("randomFiltered with maximum difficulty only", async () => {
  const svc = new PuzzleService();
  const puzzles = [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  svc.loadCsv = async () => puzzles;
  const res = await svc.randomFiltered({ difficultyMax: 1000 });
  assert.equal(res.id, "1");
});
