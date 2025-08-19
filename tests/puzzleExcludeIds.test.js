import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered respects excludeIds", async () => {
  const svc = new PuzzleService();
  const origFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    const id = call++ === 0 ? "1" : "2";
    const puzzle = { id, rating: 500, themes: "", openingTags: "" };
    return new Response(JSON.stringify(puzzle), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const res = await svc.randomFiltered({
    difficultyMin: 400,
    difficultyMax: 800,
    excludeIds: ["1"],
  });
  global.fetch = origFetch;
  assert.equal(res.id, "2");
});
