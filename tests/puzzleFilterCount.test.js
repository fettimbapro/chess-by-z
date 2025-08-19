import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("countFiltered counts puzzles matching filters", async () => {
  const svc = new PuzzleService();
  svc.loadCsv = async (path) => {
    if (path.includes("opening_sort")) {
      return [
        { id: "1", rating: 500, themes: "fork", openingTags: "A" },
        { id: "2", rating: 1500, themes: "pin", openingTags: "A" },
      ];
    }
    if (path.includes("004")) {
      return [{ id: "3", rating: 800, themes: "fork", openingTags: "B" }];
    }
    return [];
  };
  svc.listOpenings = async () => ({ A: ["001"], B: ["004"] });

  const cnt1 = await svc.countFiltered({ themes: ["fork"], opening: "A" });
  assert.equal(cnt1, 1);

  const cnt2 = await svc.countFiltered({
    difficultyMin: 700,
    difficultyMax: 1000,
  });
  assert.equal(cnt2, 1);

  const cnt3 = await svc.countFiltered({
    difficultyMin: 700,
    difficultyMax: 1000,
    excludeIds: ["3"],
  });
  assert.equal(cnt3, 0);
});
