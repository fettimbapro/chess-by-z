import { Chess } from "../vendor/chess.mjs";
import { logError } from "../util/ErrorHandler.js";

// Accepts various shapes:
// - Lichess daily/byId: { puzzle:{ id, fen, solution:[uci...]|"uci...", moves:[uci...]|"uci...", rating, themes, gameId? }, game:{ id? } }
// - Our CSV/JSON:       { id, fen, solution:[uci...]|"uci...", moves:[uci...]|"uci...", rating, themes, gameUrl }
// - Already adapted:    { id, fen, solutionSan:[...], ... }
export function adaptLichessPuzzle(input) {
  // Already adapted?
  if (input && input.fen && Array.isArray(input.solutionSan)) {
    return {
      id: input.id || "Puzzle",
      fen: input.fen,
      solutionSan: input.solutionSan.slice(),
      rating: input.rating || 0,
      themes: input.themes || "",
      gameUrl: input.gameUrl || "",
    };
  }

  // Normalise common sources
  const norm = normaliseToFenAndUci(input);
  const { id, fen, uciList, rating, themes, gameUrl, opening } = norm;

  if (!fen || !uciList.length) throw new Error("Puzzle missing FEN or moves");

  // Convert UCI -> SAN for the entire solution sequence.
  const tmp = new Chess(fen);
  const solutionSan = [];
  for (let i = 0; i < uciList.length; i++) {
    const m = uciList[i].match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!m) break;
    const step = tmp.move({
      from: m[1],
      to: m[2],
      promotion: m[3] || undefined,
    });
    if (!step) break;
    solutionSan.push(step.san);
  }

  return {
    id: id || "Lichess",
    fen,
    solutionSan,
    rating: rating || 0,
    themes: Array.isArray(themes) ? themes.join(",") : themes || "",
    gameUrl: gameUrl || "",
    opening: opening || "",
  };
}

function normaliseToFenAndUci(src) {
  if (!src) return { fen: "", uciList: [] };

  // Lichess daily/byId shape
  if (src.puzzle) {
    const p = src.puzzle || {};
    const g = src.game || {};
    // Some endpoints nest the FEN under game
    let fen = p.fen || g.fen || src.fen || "";
    // Recent Lichess endpoints omit the FEN but provide full PGN
    if (!fen && g.pgn && p.initialPly != null) {
      fen = fenFromPgn(g.pgn, +p.initialPly);
    }
    const uciList = Array.isArray(p.solution)
      ? p.solution.slice()
      : typeof p.solution === "string"
        ? p.solution.trim().split(/\s+/)
        : Array.isArray(p.moves)
          ? p.moves.slice()
          : typeof p.moves === "string"
            ? p.moves.trim().split(/\s+/)
            : [];
    const gameUrl = g.id ? `https://lichess.org/${g.id}` : src.gameUrl || "";
    return {
      id: p.id,
      fen,
      uciList,
      rating: p.rating,
      themes: p.themes,
      gameUrl,
    };
  }

  // Our CSV/JSON shape
  const fen = src.fen || src.game?.fen || "";
  const uciList = Array.isArray(src.solution)
    ? src.solution.slice()
    : typeof src.solution === "string"
      ? src.solution.trim().split(/\s+/)
      : Array.isArray(src.moves)
        ? src.moves.slice()
        : typeof src.moves === "string"
          ? src.moves.trim().split(/\s+/)
          : [];
  const opening = src.opening || src.openingTags || src.OpeningTags || "";
  return {
    id: src.id,
    fen,
    uciList,
    rating: src.rating,
    themes: src.themes,
    gameUrl: src.gameUrl,
    opening,
  };
}

function fenFromPgn(pgn, ply) {
  try {
    const target = Math.max(0, ply + 1);
    const game = new Chess();
    const moves = String(pgn || "")
      .trim()
      .split(/\s+/);
    let count = 0;
    for (let i = 0; i < moves.length && count < target; i++) {
      if (game.move(moves[i])) count++;
    }
    return game.fen();
  } catch (err) {
    logError(err, "PuzzleModel.fenFromPgn");
    return "";
  }
}
