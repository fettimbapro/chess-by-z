import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered works without difficulty filter", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async () => [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  const origRandom = Math.random;
  Math.random = () => 0; // deterministic
  const res = await svc.randomFiltered({});
  Math.random = origRandom;
  assert.equal(res.id, "1");
});
