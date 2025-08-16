import { Chess } from '../vendor/chess.mjs';

// Accepts various shapes:
// - Lichess daily/byId: { puzzle:{ id, fen, solution:[uci...], rating, themes, gameId? }, game:{ id? } }
// - Our CSV/JSON:       { id, fen, moves:"uci uci ...", rating, themes, gameUrl }
// - Already adapted:    { id, fen, solutionSan:[...], ... }
export function adaptLichessPuzzle(input){
  // Already adapted?
  if (input && input.fen && Array.isArray(input.solutionSan)) {
    return {
      id: input.id || 'Puzzle',
      fen: input.fen,
      solutionSan: input.solutionSan.slice(),
      rating: input.rating || 0,
      themes: input.themes || '',
      gameUrl: input.gameUrl || ''
    };
  }

  // Normalise common sources
  const norm = normaliseToFenAndUci(input);
  const { id, fen, uciList, rating, themes, gameUrl } = norm;

  if (!fen || !uciList.length) throw new Error('Puzzle missing FEN or moves');

  // Convert UCI -> SAN for the entire solution sequence.
  const tmp = new Chess(fen);
  const solutionSan = [];
  for (let i = 0; i < uciList.length; i++) {
    const m = uciList[i].match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!m) break;
    const step = tmp.move({ from: m[1], to: m[2], promotion: m[3] || undefined });
    if (!step) break;
    solutionSan.push(step.san);
  }

  return {
    id: id || 'Lichess',
    fen,
    solutionSan,
    rating: rating || 0,
    themes: Array.isArray(themes) ? themes.join(',') : (themes || ''),
    gameUrl: gameUrl || ''
  };
}

function normaliseToFenAndUci(src){
  if (!src) return { fen:'', uciList:[] };

  // Lichess daily/byId shape
  if (src.puzzle) {
    const p = src.puzzle || {};
    const g = src.game || {};
    const fen = p.fen || src.fen || '';
    const uciList = Array.isArray(p.solution) ? p.solution.slice()
                  : typeof p.moves === 'string' ? p.moves.trim().split(/\s+/) : [];
    const gameUrl = g.id ? `https://lichess.org/${g.id}` : (src.gameUrl || '');
    return { id: p.id, fen, uciList, rating: p.rating, themes: p.themes, gameUrl };
  }

  // Our CSV/JSON shape
  const fen = src.fen || '';
  const uciList =
    Array.isArray(src.solution) ? src.solution.slice() :
    typeof src.moves === 'string' ? src.moves.trim().split(/\s+/) : [];
  return { id: src.id, fen, uciList, rating: src.rating, themes: src.themes, gameUrl: src.gameUrl };
}

