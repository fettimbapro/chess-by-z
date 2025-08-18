// Service for loading puzzles from pre-sorted CSV packs.
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
  } = {}) {
    if (Array.isArray(difficulty)) {
      [difficultyMin, difficultyMax] = difficulty;
    }
    let min,
      max,
      diffEnabled = difficultyMin != null || difficultyMax != null;
    if (diffEnabled) {
      [min] =
        difficultyMin != null ? diffToRange(difficultyMin) : diffToRange(1);
      [, max] =
        difficultyMax != null ? diffToRange(difficultyMax) : diffToRange(10);
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
    if (opening) {
      const idx = await this.listOpenings();
      const files = idx[opening];
      if (!files || !files.length) return null;
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
        if (matches.length)
          return matches[(Math.random() * matches.length) | 0];
      }
      return null;
    } else {
      let fileIdx;
      if (!diffEnabled) {
        fileIdx = ((Math.random() * 37) | 0) + 1;
      } else {
        const target = (min + max) / 2;
        const step = 2400 / 37;
        const idx = Math.round((target - 400) / step) + 1;
        fileIdx = Math.max(1, Math.min(37, idx));
      }
      const file = String(fileIdx).padStart(3, "0");
      const arr = await this.loadCsv(
        `./lib/lichess_puzzle_db/rating_sort/lichess_db_puzzle_sorted.${file}.csv`,
      );
      const matches = arr.filter(
        (p) =>
          (!diffEnabled || (p.rating >= min && p.rating <= max)) && byTheme(p),
      );
      if (!matches.length) return null;
      return matches[(Math.random() * matches.length) | 0];
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

export function diffToRange(level) {
  const base = 400;
  const step = 300;
  const min = base + (level - 1) * step;
  const max = base + level * step;
  return [min, max];
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
