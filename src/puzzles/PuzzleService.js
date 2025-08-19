// Service for retrieving puzzles without downloading entire CSV packs.

// Endpoint for a Cloudflare Worker that proxies requests to the D1 database.
// The worker should return JSON and set appropriate CORS headers.
// Override `window.PUZZLE_D1_URL` at runtime to point at your deployed worker.
const D1_WORKER_URL =
  globalThis?.PUZZLE_D1_URL ??
  "https://puzzle-db-worker.fettimbapro.workers.dev";

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
    if (difficultyMin == null && difficultyMax != null) difficultyMin = 0;
    if (difficultyMax == null && difficultyMin != null) difficultyMax = 3500;
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

  async queryD1(sql, params = []) {
    const r = await fetch(D1_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (
      data?.results ||
      data?.result?.[0]?.results ||
      data?.result?.[0] ||
      data?.result ||
      []
    );
  }

  async randomFiltered(opts = {}) {
    const excludeSet = new Set(
      Array.isArray(opts.excludeIds)
        ? opts.excludeIds.filter(Boolean)
        : [opts.excludeIds].filter(Boolean),
    );

    if (typeof this.loadCsv === "function") {
      let puzzles = await this.loadCsv(opts);
      const min = opts.difficultyMin != null ? opts.difficultyMin : 0;
      const max = opts.difficultyMax != null ? opts.difficultyMax : 3500;
      puzzles = puzzles.filter((p) => p.rating >= min && p.rating <= max);
      if (opts.opening)
        puzzles = puzzles.filter((p) => p.openingTags?.includes(opts.opening));
      const themeList = Array.isArray(opts.themes)
        ? opts.themes.filter(Boolean)
        : String(opts.themes ?? "")
            .split(/[,\s]+/)
            .filter(Boolean);
      for (const t of themeList)
        puzzles = puzzles.filter((p) => p.themes?.includes(t));
      puzzles = puzzles.filter((p) => !excludeSet.has(p.id));
      if (!puzzles.length) return null;
      const idx = Math.floor(Math.random() * puzzles.length);
      return puzzles[idx] || null;
    }

    let { difficultyMin, difficultyMax, opening = "", themes = [] } = opts;
    if (difficultyMin == null && difficultyMax != null) difficultyMin = 0;
    if (difficultyMax == null && difficultyMin != null) difficultyMax = 3500;

    const where = [];
    const params = [];
    if (difficultyMin != null) {
      where.push("Rating >= ?");
      params.push(difficultyMin);
    }
    if (difficultyMax != null) {
      where.push("Rating <= ?");
      params.push(difficultyMax);
    }
    if (opening) {
      where.push("OpeningTags LIKE ?");
      params.push(`%${opening}%`);
    }
    const themeList = Array.isArray(themes)
      ? themes.filter(Boolean)
      : String(themes)
          .split(/[,\s]+/)
          .filter(Boolean);
    for (const t of themeList) {
      where.push("Themes LIKE ?");
      params.push(`%${t}%`);
    }
    if (excludeSet.size) {
      where.push(
        `PuzzleId NOT IN (${Array.from(excludeSet)
          .map(() => "?")
          .join(",")})`,
      );
      params.push(...excludeSet);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `SELECT PuzzleId as id, FEN as fen, Moves as moves, Rating as rating, RatingDeviation as ratingDeviation, Popularity as popularity, NbPlays as nbPlays, Themes as themes, GameUrl as gameUrl, OpeningTags as openingTags FROM puzzles ${whereClause} ORDER BY RANDOM() LIMIT 1;`;
    const rows = await this.queryD1(sql, params);
    return rows[0] || null;
  }

  async countFiltered(opts = {}) {
    const excludeSet = new Set(
      Array.isArray(opts.excludeIds)
        ? opts.excludeIds.filter(Boolean)
        : [opts.excludeIds].filter(Boolean),
    );

    if (typeof this.loadCsv === "function") {
      let puzzles = await this.loadCsv(opts);
      const min = opts.difficultyMin != null ? opts.difficultyMin : 0;
      const max = opts.difficultyMax != null ? opts.difficultyMax : 3500;
      puzzles = puzzles.filter((p) => p.rating >= min && p.rating <= max);
      if (opts.opening)
        puzzles = puzzles.filter((p) => p.openingTags?.includes(opts.opening));
      const themeList = Array.isArray(opts.themes)
        ? opts.themes.filter(Boolean)
        : String(opts.themes ?? "")
            .split(/[,\s]+/)
            .filter(Boolean);
      for (const t of themeList)
        puzzles = puzzles.filter((p) => p.themes?.includes(t));
      puzzles = puzzles.filter((p) => !excludeSet.has(p.id));
      return puzzles.length;
    }

    let { difficultyMin, difficultyMax, opening = "", themes = [] } = opts;
    if (difficultyMin == null && difficultyMax != null) difficultyMin = 0;
    if (difficultyMax == null && difficultyMin != null) difficultyMax = 3500;
    const where = [];
    const params = [];
    if (difficultyMin != null) {
      where.push("Rating >= ?");
      params.push(difficultyMin);
    }
    if (difficultyMax != null) {
      where.push("Rating <= ?");
      params.push(difficultyMax);
    }
    if (opening) {
      where.push("OpeningTags LIKE ?");
      params.push(`%${opening}%`);
    }
    const themeList = Array.isArray(themes)
      ? themes.filter(Boolean)
      : String(themes)
          .split(/[,\s]+/)
          .filter(Boolean);
    for (const t of themeList) {
      where.push("Themes LIKE ?");
      params.push(`%${t}%`);
    }
    if (excludeSet.size) {
      where.push(
        `PuzzleId NOT IN (${Array.from(excludeSet)
          .map(() => "?")
          .join(",")})`,
      );
      params.push(...excludeSet);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `SELECT COUNT(*) as count FROM puzzles ${whereClause};`;
    const rows = await this.queryD1(sql, params);
    return +rows[0]?.count || 0;
  }
}
