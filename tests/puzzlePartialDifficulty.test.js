import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("randomFiltered with minimum difficulty only", async () => {
  const svc = new PuzzleService();
  const origFetch = global.fetch;
  const puzzles = [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  global.fetch = async (url) => {
    const u = new URL(url, "http://localhost");
    const min = +(u.searchParams.get("ratingMin") || 0);
    const max = +(u.searchParams.get("ratingMax") || Infinity);
    const eligible = puzzles.filter((p) => p.rating >= min && p.rating <= max);
    return new Response(JSON.stringify(eligible[0] || null), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const res = await svc.randomFiltered({ difficultyMin: 600 });
  global.fetch = origFetch;
  assert.equal(res.id, "2");
});

test("randomFiltered with maximum difficulty only", async () => {
  const svc = new PuzzleService();
  const origFetch = global.fetch;
  const puzzles = [
    { id: "1", rating: 500, themes: "", openingTags: "" },
    { id: "2", rating: 2500, themes: "", openingTags: "" },
  ];
  global.fetch = async (url) => {
    const u = new URL(url, "http://localhost");
    const min = +(u.searchParams.get("ratingMin") || 0);
    const max = +(u.searchParams.get("ratingMax") || Infinity);
    const eligible = puzzles.filter((p) => p.rating >= min && p.rating <= max);
    return new Response(JSON.stringify(eligible[0] || null), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const res = await svc.randomFiltered({ difficultyMax: 1000 });
  global.fetch = origFetch;
  assert.equal(res.id, "1");
});
