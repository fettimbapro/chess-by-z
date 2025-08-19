// Service for retrieving puzzles without downloading entire CSV packs.

export class PuzzleService {
  constructor() {
    this.openingsIndex = null;
  }

  async fetchDaily() {
    const r = await fetch("https://lichess.org/api/puzzle/daily", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async listOpenings() {
    if (this.openingsIndex) return this.openingsIndex;
    const r = await fetch("./lib/lichess_puzzle_db/openings_index.json");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    this.openingsIndex = await r.json();
    return this.openingsIndex;
  }

  buildParams({
    difficultyMin,
    difficultyMax,
    opening = "",
    themes = [],
    excludeIds = [],
  } = {}) {
    const params = new URLSearchParams();
    if (difficultyMin != null) params.set("ratingMin", difficultyMin);
    if (difficultyMax != null) params.set("ratingMax", difficultyMax);
    if (opening) params.set("opening", opening);
    const themeList = Array.isArray(themes)
      ? themes.filter(Boolean)
      : String(themes)
          .split(/[,\s]+/)
          .filter(Boolean);
    for (const t of themeList) params.append("theme", t);
    const excludeList = Array.isArray(excludeIds)
      ? excludeIds.filter(Boolean)
      : [excludeIds].filter(Boolean);
    for (const id of excludeList) params.append("exclude", id);
    return params;
  }

  async randomFiltered(opts = {}) {
    const params = this.buildParams(opts);
    const excludeSet = new Set(
      Array.isArray(opts.excludeIds)
        ? opts.excludeIds.filter(Boolean)
        : [opts.excludeIds].filter(Boolean),
    );
    let attempts = 5;
    while (attempts-- > 0) {
      const r = await fetch(`/api/puzzle?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const puzzle = await r.json();
      if (!puzzle || !puzzle.id) return null;
      if (!excludeSet.has(puzzle.id)) return puzzle;
    }
    return null;
  }

  async countFiltered(opts = {}) {
    const params = this.buildParams(opts);
    params.set("count", "1");
    const r = await fetch(`/api/puzzle?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return +data.count || 0;
  }
}
