import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered works without difficulty filter", async () => {
  const svc = new PuzzleService();
  const origFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({ id: "1", rating: 500, themes: "", openingTags: "" }),
      { headers: { "Content-Type": "application/json" } },
    );
  const res = await svc.randomFiltered({});
  global.fetch = origFetch;
  assert.equal(res.id, "1");
});
