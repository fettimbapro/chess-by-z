import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("countFiltered counts puzzles matching filters", async () => {
  const svc = new PuzzleService();
  const origFetch = global.fetch;
  const puzzles = [
    { id: "1", rating: 500, themes: "fork", openingTags: "A" },
    { id: "2", rating: 1500, themes: "pin", openingTags: "A" },
    { id: "3", rating: 800, themes: "fork", openingTags: "B" },
  ];
  global.fetch = async (url) => {
    const u = new URL(url, "http://localhost");
    const isCount = u.searchParams.has("count");
    const opening = u.searchParams.get("opening");
    const theme = u.searchParams.get("theme");
    const min = +(u.searchParams.get("ratingMin") || 0);
    const max = +(u.searchParams.get("ratingMax") || Infinity);
    const exclude = new Set(u.searchParams.getAll("exclude"));
    let filtered = puzzles.filter((p) => p.rating >= min && p.rating <= max);
    if (opening)
      filtered = filtered.filter((p) => p.openingTags.includes(opening));
    if (theme) filtered = filtered.filter((p) => p.themes.includes(theme));
    filtered = filtered.filter((p) => !exclude.has(p.id));
    if (isCount) {
      return new Response(JSON.stringify({ count: filtered.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(filtered[0] || null), {
      headers: { "Content-Type": "application/json" },
    });
  };

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
  global.fetch = origFetch;
  assert.equal(cnt3, 0);
});
