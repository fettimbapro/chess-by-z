// Service for loading puzzles from pre-sorted CSV packs.

const RATING_CAPS = [
  574, 689, 786, 848, 900, 945, 986, 1028, 1069, 1106, 1150, 1187, 1229, 1274,
  1320, 1366, 1410, 1459, 1504, 1550, 1596, 1642, 1689, 1738, 1791, 1846, 1905,
  1959, 2017, 2081, 2151, 2225, 2303, 2402, 2550, 2772, 3316,
];

function ratingToFileIdx(r) {
  for (let i = 0; i < RATING_CAPS.length; i++) {
    if (r <= RATING_CAPS[i]) return i + 1;
  }
  return RATING_CAPS.length;
}

export class PuzzleService {
  constructor() {
    this.cache = {};
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

  async randomFiltered({
    difficulty,
    difficultyMin,
    difficultyMax,
    opening = "",
    themes = [],
    excludeIds = [],
  } = {}) {
    if (Array.isArray(difficulty)) {
      [difficultyMin, difficultyMax] = difficulty;
    }
    const diffEnabled = difficultyMin != null || difficultyMax != null;
    let min = 400,
      max = 3400;
    if (diffEnabled) {
      if (difficultyMin != null) min = difficultyMin;
      if (difficultyMax != null) max = difficultyMax;
    }
    const themeList = Array.isArray(themes)
      ? themes.filter(Boolean)
      : String(themes)
          .split(/[,\s]+/)
          .filter(Boolean);
    const byTheme = (p) =>
      !themeList.length ||
      themeList.every((t) =>
        String(p.themes || "")
          .toLowerCase()
          .includes(t.toLowerCase()),
      );
    const excludeSet = new Set(
      Array.isArray(excludeIds)
        ? excludeIds.filter(Boolean)
        : [excludeIds].filter(Boolean),
    );
    if (opening) {
      const idx = await this.listOpenings();
      const files = idx[opening];
      if (!files || !files.length) return null;
      const fallback = [];
      for (const f of files) {
        const arr = await this.loadCsv(
          `./lib/lichess_puzzle_db/opening_sort/lichess_db_puzzle_by_opening.${f}.csv`,
        );
        const matches = arr.filter(
          (p) =>
            (!diffEnabled || (p.rating >= min && p.rating <= max)) &&
            String(p.openingTags || "").includes(opening) &&
            byTheme(p),
        );
        const filtered = excludeSet.size
          ? matches.filter((p) => !excludeSet.has(p.id))
          : matches;
        if (filtered.length)
          return filtered[(Math.random() * filtered.length) | 0];
        fallback.push(...matches);
      }
      return fallback.length
        ? fallback[(Math.random() * fallback.length) | 0]
        : null;
    } else {
      let idxMin, idxMax;
      if (!diffEnabled) {
        idxMin = idxMax = ((Math.random() * 37) | 0) + 1;
      } else {
        idxMin = ratingToFileIdx(min);
        idxMax = ratingToFileIdx(max);
      }
      let matches = [];
      for (let i = idxMin; i <= idxMax; i++) {
        const file = String(i).padStart(3, "0");
        const arr = await this.loadCsv(
          `./lib/lichess_puzzle_db/rating_sort/lichess_db_puzzle_sorted.${file}.csv`,
        );
        matches.push(
          ...arr.filter(
            (p) =>
              (!diffEnabled || (p.rating >= min && p.rating <= max)) &&
              byTheme(p),
          ),
        );
      }
      if (!matches.length) return null;
      const filtered = excludeSet.size
        ? matches.filter((p) => !excludeSet.has(p.id))
        : matches;
      const pool = filtered.length ? filtered : matches;
      return pool[(Math.random() * pool.length) | 0];
    }
  }

  async countFiltered({
    difficulty,
    difficultyMin,
    difficultyMax,
    opening = "",
    themes = [],
    excludeIds = [],
  } = {}) {
    if (Array.isArray(difficulty)) {
      [difficultyMin, difficultyMax] = difficulty;
    }
    const diffEnabled = difficultyMin != null || difficultyMax != null;
    let min = 400,
      max = 3400;
    if (diffEnabled) {
      if (difficultyMin != null) min = difficultyMin;
      if (difficultyMax != null) max = difficultyMax;
    }
    const themeList = Array.isArray(themes)
      ? themes.filter(Boolean)
      : String(themes)
          .split(/[,\s]+/)
          .filter(Boolean);
    const byTheme = (p) =>
      !themeList.length ||
      themeList.every((t) =>
        String(p.themes || "")
          .toLowerCase()
          .includes(t.toLowerCase()),
      );
    const excludeSet = new Set(
      Array.isArray(excludeIds)
        ? excludeIds.filter(Boolean)
        : [excludeIds].filter(Boolean),
    );
    if (opening) {
      const idx = await this.listOpenings();
      const files = idx[opening];
      if (!files || !files.length) return 0;
      let total = 0;
      for (const f of files) {
        const arr = await this.loadCsv(
          `./lib/lichess_puzzle_db/opening_sort/lichess_db_puzzle_by_opening.${f}.csv`,
        );
        const matches = arr.filter(
          (p) =>
            (!diffEnabled || (p.rating >= min && p.rating <= max)) &&
            String(p.openingTags || "").includes(opening) &&
            byTheme(p),
        );
        const filtered = excludeSet.size
          ? matches.filter((p) => !excludeSet.has(p.id))
          : matches;
        total += filtered.length;
      }
      return total;
    } else {
      let idxMin, idxMax;
      if (!diffEnabled) {
        idxMin = idxMax = ((Math.random() * 37) | 0) + 1;
      } else {
        idxMin = ratingToFileIdx(min);
        idxMax = ratingToFileIdx(max);
      }
      let total = 0;
      for (let i = idxMin; i <= idxMax; i++) {
        const file = String(i).padStart(3, "0");
        const arr = await this.loadCsv(
          `./lib/lichess_puzzle_db/rating_sort/lichess_db_puzzle_sorted.${file}.csv`,
        );
        const matches = arr.filter(
          (p) =>
            (!diffEnabled || (p.rating >= min && p.rating <= max)) &&
            byTheme(p),
        );
        const filtered = excludeSet.size
          ? matches.filter((p) => !excludeSet.has(p.id))
          : matches;
        total += filtered.length;
      }
      return total;
    }
  }

  async loadCsv(path) {
    if (this.cache[path]) return this.cache[path];
    const text = await (await fetch(path)).text();
    const lines = text.trim().split(/\r?\n/);
    const head = lines[0].split(",");
    const idx = (k) => head.indexOf(k);
    const iId = idx("PuzzleId"),
      iFen = idx("FEN"),
      iMoves = idx("Moves"),
      iRating = idx("Rating"),
      iThemes = idx("Themes"),
      iGame = idx("GameUrl"),
      iOpen = idx("OpeningTags");
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = safeCsvSplit(lines[i], head.length);
      out.push({
        id: get(cols, iId),
        fen: get(cols, iFen),
        moves: get(cols, iMoves),
        rating: +(get(cols, iRating) || 0),
        themes: get(cols, iThemes) || "",
        gameUrl: get(cols, iGame) || "",
        openingTags: get(cols, iOpen) || "",
      });
    }
    this.cache[path] = out;
    return out;
  }
}
function get(a, i) {
  return i >= 0 && i < a.length ? a[i] : "";
}
function safeCsvSplit(line, expect) {
  const out = [];
  let cur = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch == '"') {
      if (q && line[i + 1] == '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (!q && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  while (out.length < expect) out.push("");
  return out;
}
