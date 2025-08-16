import test from "node:test";
import assert from "node:assert/strict";
import { PuzzleService } from "../chess-website-uml/public/src/puzzles/PuzzleService.js";

test("playlistFromPack filters by theme, opening and rating", () => {
  const svc = new PuzzleService();
  svc.pack = [
    { id: "a", rating: 900, themes: "fork", opening: "Sicilian" },
    { id: "b", rating: 1200, themes: "mate", opening: "French" },
    { id: "c", rating: 1150, themes: "fork", opening: "Sicilian" },
  ];
  const list = svc.playlistFromPack({
    theme: "fork",
    opening: "Sicilian",
    min: 1000,
    max: 1300,
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "c");
});
