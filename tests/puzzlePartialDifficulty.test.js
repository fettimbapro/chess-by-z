import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered with minimum difficulty only", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async () => [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  const origRandom = Math.random;
  Math.random = () => 0;
  const res = await svc.randomFiltered({ difficultyMin: 600 });
  Math.random = origRandom;
  assert.equal(res.id, "2");
});

test("randomFiltered with maximum difficulty only", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async () => [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  const origRandom = Math.random;
  Math.random = () => 0;
  const res = await svc.randomFiltered({ difficultyMax: 1000 });
  Math.random = origRandom;
  assert.equal(res.id, "1");
});
