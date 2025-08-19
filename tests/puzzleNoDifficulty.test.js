import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered works without difficulty filter", async () => {
  const svc = new PuzzleService();
  const puzzles = [{ id: "1", rating: 500, themes: "", openingTags: "" }];
  svc.loadCsv = async () => puzzles;
  const res = await svc.randomFiltered({});
  assert.equal(res.id, "1");
});
