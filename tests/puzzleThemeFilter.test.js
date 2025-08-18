import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered filters by themes", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async () => [
    { id: "1", rating: 500, themes: "fork", openingTags: "" },
    { id: "2", rating: 500, themes: "pin", openingTags: "" },
  ];
  const res1 = await svc.randomFiltered({
    difficultyMin: 1,
    difficultyMax: 1,
    themes: ["fork"],
  });
  assert.equal(res1.id, "1");
  const res2 = await svc.randomFiltered({
    difficultyMin: 1,
    difficultyMax: 1,
    themes: ["pin"],
  });
  assert.equal(res2.id, "2");
  const res3 = await svc.randomFiltered({
    difficultyMin: 1,
    difficultyMax: 1,
    themes: ["skewer"],
  });
  assert.equal(res3, null);
});
