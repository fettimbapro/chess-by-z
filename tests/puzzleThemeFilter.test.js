import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered filters by themes", async () => {
  const svc = new PuzzleService();
  const puzzles = [
    { id: "1", rating: 500, themes: "fork", openingTags: "" },
    { id: "2", rating: 500, themes: "pin", openingTags: "" },
  ];
  svc.loadCsv = async () => puzzles;
  const res1 = await svc.randomFiltered({
    difficultyMin: 400,
    difficultyMax: 800,
    themes: ["fork"],
  });
  assert.equal(res1.id, "1");
  const res2 = await svc.randomFiltered({
    difficultyMin: 400,
    difficultyMax: 800,
    themes: ["pin"],
  });
  assert.equal(res2.id, "2");
  const res3 = await svc.randomFiltered({
    difficultyMin: 400,
    difficultyMax: 800,
    themes: ["skewer"],
  });
  assert.equal(res3, null);
});
