// src/workers/mini-engine.js
// Lightweight chess engine worker (no deps except chess.mjs) with PST and mobility evaluation.

import { Chess } from "../vendor/chess.mjs";

// ===== Search tunables =====
const INF = 1e9,
  MATE = 1e7;
const FUT_MARGIN = 100; // futility margin (cp)
const RAZOR_MARGIN = 200; // razoring margin (cp)
const LMR_MOVE_THRESHOLD = 3; // start reducing after this move index
const LMR_MIN_DEPTH = 3;
const CHECK_EXT = 1; // +1 ply for checks/promotions
const STATIC_NULL_MARGIN = 250; // static fail-high gate
const STATIC_NULL_MIN_DEPTH = 3;

// Null-move pruning (true null move)
const NULL_MIN_DEPTH = 3;
const NULL_R_BASE = 2; // reduction base
const NULL_R_SCALE = 4; // depth/scale term

// History / killers / TT
const TT = new Map();
const TT_MAX = 200000;
const killers = []; // killers[ply] = [uci1, uci2]
const history = new Map(); // key -> score

// ===== Piece values (centipawns) =====
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 950, k: 20000 };

// Piece-square tables (PeSTO evaluation) for midgame and endgame
// Values are indexed from a1 (0) to h8 (63). Black pieces mirror these tables.
const PST_MG = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 98, 134, 61, 95, 68, 126, 34, -11, -6, 7, 26, 31,
    65, 56, 25, -20, -14, 13, 6, 21, 23, 12, 17, -23, -27, -2, -5, 12, 17, 6,
    10, -25, -26, -4, -4, -10, 3, 3, 33, -12, -35, -1, -20, -23, -15, 24, 38,
    -22, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -167, -89, -34, -49, 61, -97, -15, -107, -73, -41, 72, 36, 23, 62, 7, -17,
    -47, 60, 37, 65, 84, 129, 73, 44, -9, 17, 19, 53, 37, 69, 18, 22, -13, 4,
    16, 13, 28, 19, 21, -8, -23, -9, 12, 10, 19, 17, 25, -16, -29, -53, -12, -3,
    -1, 18, -14, -19, -105, -21, -58, -33, -17, -28, -19, -23,
  ],
  b: [
    -29, 4, -82, -37, -25, -42, 7, -8, -26, 16, -18, -13, 30, 59, 18, -47, -16,
    37, 43, 40, 35, 50, 37, -2, -4, 5, 19, 50, 37, 37, 7, -2, -6, 13, 13, 26,
    34, 12, 10, 4, 0, 15, 15, 15, 14, 27, 18, 10, 4, 15, 16, 0, 7, 21, 33, 1,
    -33, -3, -14, -21, -13, -12, -39, -21,
  ],
  r: [
    32, 42, 32, 51, 63, 9, 31, 43, 27, 32, 58, 62, 80, 67, 26, 44, -5, 19, 26,
    36, 17, 45, 61, 16, -24, -11, 7, 26, 24, 35, -8, -20, -36, -26, -12, -1, 9,
    -7, 6, -23, -45, -25, -16, -17, 3, 0, -5, -33, -44, -16, -20, -9, -1, 11,
    -6, -71, -19, -13, 1, 17, 16, 7, -37, -26,
  ],
  q: [
    -28, 0, 29, 12, 59, 44, 43, 45, -24, -39, -5, 1, -16, 57, 28, 54, -13, -17,
    7, 8, 29, 56, 47, 57, -27, -27, -16, -16, -1, 17, -2, 1, -9, -26, -9, -10,
    -2, -4, 3, -3, -14, 2, -11, -2, -5, 2, 14, 5, -35, -8, 11, 2, 8, 15, -3, 1,
    -1, -18, -9, 10, -15, -25, -31, -50,
  ],
  k: [
    -65, 23, 16, -15, -56, -34, 2, 13, 29, -1, -20, -7, -8, -4, -38, -29, -9,
    24, 2, -16, -20, 6, 22, -22, -17, -20, -12, -27, -30, -25, -14, -36, -49,
    -1, -27, -39, -46, -44, -33, -51, -14, -14, -22, -46, -44, -30, -15, -27, 1,
    7, -8, -64, -43, -16, 9, 8, -15, 36, 12, -54, 8, -28, 24, 14,
  ],
};

const PST_EG = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 178, 173, 158, 134, 147, 132, 165, 187, 94, 100, 85,
    67, 56, 53, 82, 84, 32, 24, 13, 5, -2, 4, 17, 17, 13, 9, -3, -7, -7, -8, 3,
    -1, 4, 7, -6, 1, 0, -5, -1, -8, 13, 8, 8, 10, 13, 0, 2, -7, 0, 0, 0, 0, 0,
    0, 0, 0,
  ],
  n: [
    -58, -38, -13, -28, -31, -27, -63, -99, -25, -8, -25, -2, -9, -25, -24, -52,
    -24, -20, 10, 9, -1, -9, -19, -41, -17, 3, 22, 22, 22, 11, 8, -18, -18, -6,
    16, 25, 16, 17, 4, -18, -23, -3, -1, 15, 10, -3, -20, -22, -42, -20, -10,
    -5, -2, -20, -23, -44, -29, -51, -23, -15, -22, -18, -50, -64,
  ],
  b: [
    -14, -21, -11, -8, -7, -9, -17, -24, -8, -4, 7, -12, -3, -13, -4, -14, 2,
    -8, 0, -1, -2, 6, 0, 4, -3, 9, 12, 9, 14, 10, 3, 2, -6, 3, 13, 19, 7, 10,
    -3, -9, -12, -3, 8, 10, 13, 3, -7, -15, -14, -18, -7, -1, 4, -9, -15, -27,
    -23, -9, -23, -5, -9, -16, -5, -17,
  ],
  r: [
    13, 10, 18, 15, 12, 12, 8, 5, 11, 13, 13, 11, -3, 3, 8, 3, 7, 7, 7, 5, 4,
    -3, -5, -3, 4, 3, 13, 1, 2, 1, -1, 2, 3, 5, 8, 4, -5, -6, -8, -11, -4, 0,
    -5, -1, -7, -12, -8, -16, -6, -6, 0, 2, -9, -9, -11, -3, -9, 2, 3, -1, -5,
    -13, 4, -20,
  ],
  q: [
    -9, 22, 22, 27, 27, 19, 10, 20, -17, 20, 32, 41, 58, 25, 30, 0, -20, 6, 9,
    49, 47, 35, 19, 9, 3, 22, 24, 45, 57, 40, 57, 36, -18, 28, 19, 47, 31, 34,
    39, 23, -16, -27, 15, 6, 9, 17, 10, 5, -22, -23, -30, -16, -16, -23, -36,
    -32, -33, -28, -22, -43, -5, -32, -20, -41,
  ],
  k: [
    -74, -35, -18, -18, -11, 15, 4, -17, -12, 17, 14, 17, 17, 38, 23, 11, 10,
    17, 23, 15, 20, 45, 44, 13, -8, 22, 24, 27, 26, 33, 26, 3, -18, -4, 21, 24,
    27, 23, 9, -11, -19, -3, 11, 21, 23, 16, 7, -9, -27, -11, 4, 13, 14, 4, -5,
    -17, -53, -34, -21, -11, -28, -14, -24, -43,
  ],
};

function pstScore(type, color, r, f) {
  const idx = color === "w" ? (7 - r) * 8 + f : r * 8 + (7 - f);
  return { mg: PST_MG[type]?.[idx] || 0, eg: PST_EG[type]?.[idx] || 0 };
}

// ===== Small helpers =====
const toUci = (m) => m.from + m.to + (m.promotion || "");
const isCapture = (m) =>
  !!(
    m.captured ||
    (m.flags && (m.flags.includes("c") || m.flags.includes("e")))
  );
const isPromotion = (m) => !!m.promotion;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const inCheck = (ch) => ch.isCheck?.() || ch.in_check?.() || false;

function mvvLva(m) {
  const cap = m.captured ? VAL[m.captured] : 0;
  const att = VAL[m.piece] || 0;
  return cap * 10 - att;
}
function moveKey(m) {
  return m.from + m.to + (m.promotion || "") + m.piece;
}
function addHistory(m, d) {
  if (isCapture(m)) return;
  const k = moveKey(m);
  history.set(k, (history.get(k) || 0) + d * d);
}
function pushKiller(uci, ply) {
  killers[ply] = killers[ply] || [];
  if (killers[ply][0] !== uci) {
    killers[ply][1] = killers[ply][0];
    killers[ply][0] = uci;
  }
}

function orderMoves(list, ttUci, ply, ch) {
  const ks = killers[ply] || [];
  return list
    .map((m) => {
      let s = 0,
        u = toUci(m);
      if (ttUci && u === ttUci) s += 1e9; // hash move first
      if (isCapture(m)) s += 5e8 + mvvLva(m); // captures (MVV-LVA)
      if (isPromotion(m)) s += 4.5e8;
      // bonus for moves that give check to improve move ordering
      ch.move(m);
      if (inCheck(ch)) s += 2e8;
      ch.undo();
      if (ks[0] === u) s += 4e8;
      if (ks[1] === u) s += 3e8;
      s += history.get(moveKey(m)) || 0;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

// ====== Piece mobility evaluation ======
// Offsets for piece movement (row, file deltas)
const MOB_VECTORS = {
  n: [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ],
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
};

const MOB_WEIGHT = {
  n: { mg: 4, eg: 4 },
  b: { mg: 4, eg: 5 },
  r: { mg: 2, eg: 3 },
  q: { mg: 1, eg: 2 },
};

function pieceMobility(type, color, r, f, board) {
  const enemy = color === "w" ? "b" : "w";
  let count = 0;
  if (type === "n") {
    for (const [dr, df] of MOB_VECTORS.n) {
      const rr = r + dr,
        ff = f + df;
      if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
      const sq = board[rr][ff];
      if (!sq || sq.color === enemy) count++;
    }
  } else {
    const dirs = [];
    if (type === "b" || type === "q") dirs.push(...MOB_VECTORS.b);
    if (type === "r" || type === "q") dirs.push(...MOB_VECTORS.r);
    for (const [dr, df] of dirs) {
      let rr = r + dr,
        ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const sq = board[rr][ff];
        if (!sq) {
          count++;
        } else {
          if (sq.color === enemy) count++;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
  }
  return count;
}

// ====== Tapered Evaluation (midgame/endgame blend) ======
function manhattan(f, r) {
  return Math.abs(f - 3.5) + Math.abs(r - 3.5);
}

function evalBoard(ch) {
  const b = ch.board();
  let mg = 0,
    eg = 0;
  let phase = 0; // 0..24 (rough PeSTO-like)
  let wb = 0,
    bb = 0;
  const wFiles = Array(8).fill(0),
    bFiles = Array(8).fill(0);
  const wPawnRanks = Array.from({ length: 8 }, () => []);
  const bPawnRanks = Array.from({ length: 8 }, () => []);
  const wRooks = [],
    bRooks = [];
  let wKing = null,
    bKing = null;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = b[r][f];
      if (!sq) continue;
      const color = sq.color,
        type = sq.type;
      const sign = color === "w" ? 1 : -1;

      // material
      const v = VAL[type] || 0;
      mg += sign * v;
      eg += sign * v;
      const pst = pstScore(type, color, r, f);
      mg += sign * pst.mg;
      eg += sign * pst.eg;

      // phase (no pawns)
      if (type !== "p") phase += type === "q" ? 4 : type === "r" ? 2 : 1;

      const rankW = 8 - r; // 1..8 from white side

      // centralization / activity (MG)
      if (type === "n") {
        const d = manhattan(f, r);
        mg += sign * Math.max(0, 28 - Math.round(d * 7));
      } else if (type === "b") {
        const d = manhattan(f, r);
        mg += sign * Math.max(0, 22 - Math.round(d * 6));
        if (color === "w") wb++;
        else bb++;
      } else if (type === "q") {
        const d = manhattan(f, r);
        mg += sign * Math.max(0, 14 - Math.round(d * 3));
      } else if (type === "r") {
        // rook on 7th
        const seventh = color === "w" ? rankW === 7 : rankW === 2;
        if (seventh) mg += sign * 18;
        if (color === "w") wRooks.push(f);
        else bRooks.push(f);
      } else if (type === "k") {
        if (color === "w") wKing = { f, r };
        else bKing = { f, r };
      } else if (type === "p") {
        // track pawns for structure
        if (color === "w") {
          wFiles[f]++;
          wPawnRanks[f].push(rankW);
        } else {
          bFiles[f]++;
          bPawnRanks[f].push(rankW);
        }

        // advancement
        const advW = color === "w" ? rankW - 2 : 7 - rankW; // 0..5
        mg += sign * advW * 5;
        eg += sign * advW * 9;
      }

      // mobility bonus for pieces
      if (MOB_WEIGHT[type]) {
        const mob = pieceMobility(type, color, r, f, b);
        mg += sign * MOB_WEIGHT[type].mg * mob;
        eg += sign * MOB_WEIGHT[type].eg * mob;
      }
    }
  }

  // bishop pair
  if (wb >= 2) {
    mg += 30;
    eg += 20;
  }
  if (bb >= 2) {
    mg -= 30;
    eg -= 20;
  }

  // doubled / isolated
  for (let f = 0; f < 8; f++) {
    if (wFiles[f] > 1) {
      mg -= 12 * (wFiles[f] - 1);
      eg -= 8 * (wFiles[f] - 1);
    }
    if (bFiles[f] > 1) {
      mg += 12 * (bFiles[f] - 1);
      eg += 8 * (bFiles[f] - 1);
    }
    if (wFiles[f]) {
      const neigh = (f > 0 ? wFiles[f - 1] : 0) + (f < 7 ? wFiles[f + 1] : 0);
      if (!neigh) {
        mg -= 10 * wFiles[f];
        eg -= 6 * wFiles[f];
      }
    }
    if (bFiles[f]) {
      const neigh = (f > 0 ? bFiles[f - 1] : 0) + (f < 7 ? bFiles[f + 1] : 0);
      if (!neigh) {
        mg += 10 * bFiles[f];
        eg += 6 * bFiles[f];
      }
    }
  }

  // rooks on open and semi-open files
  for (const f of wRooks) {
    if (wFiles[f] === 0) {
      if (bFiles[f] === 0) {
        mg += 20;
        eg += 10;
      } // open file
      else {
        mg += 10;
        eg += 5;
      } // semi-open
    }
  }
  for (const f of bRooks) {
    if (bFiles[f] === 0) {
      if (wFiles[f] === 0) {
        mg -= 20;
        eg -= 10;
      } else {
        mg -= 10;
        eg -= 5;
      }
    }
  }

  // passed pawns
  for (let f = 0; f < 8; f++) {
    for (const rw of wPawnRanks[f]) {
      let blocked = false;
      for (let df = -1; df <= 1; df++) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        for (const rb of bPawnRanks[ff]) {
          if (rb > rw) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (!blocked) {
        const adv = rw - 2; // 0..5
        mg += 12 + adv * 8;
        eg += 20 + adv * 14;
      }
    }
    for (const rb of bPawnRanks[f]) {
      let blocked = false;
      for (let df = -1; df <= 1; df++) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        for (const rw of wPawnRanks[ff]) {
          if (rw < rb) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (!blocked) {
        const adv = 7 - rb; // 0..5
        mg -= 12 + adv * 8;
        eg -= 20 + adv * 14;
      }
    }
  }

  // king safety (MG): pawn shield and exposure
  function pawnShieldScore(king, files, ranksByFile, color) {
    if (!king) return 0;
    const f = king.f;
    const r1 = color === "w" ? 2 : 7;
    const r2 = color === "w" ? 3 : 6;
    let s = 0;
    for (let df = -1; df <= 1; df++) {
      const ff = f + df;
      if (ff < 0 || ff > 7) continue;
      const arr = ranksByFile[ff];
      if (arr.includes(r1) || arr.includes(r2)) s++;
    }
    return s; // 0..3
  }
  const wShield = pawnShieldScore(wKing, wFiles, wPawnRanks, "w");
  const bShield = pawnShieldScore(bKing, bFiles, bPawnRanks, "b");
  mg += (wShield - bShield) * 16;

  function exposure(files, f0) {
    let e = 0;
    for (let df = -1; df <= 1; df++) {
      const ff = f0 + df;
      if (ff < 0 || ff > 7) continue;
      e += files[ff] ? 0 : 1;
    }
    return e;
  }
  if (wKing) mg -= exposure(wFiles, wKing.f) * 10;
  if (bKing) mg += exposure(bFiles, bKing.f) * 10;

  // king activity in endgame – encourage centralisation
  function kingEgCenter(k) {
    if (!k) return 0;
    const d = manhattan(k.f, k.r);
    return Math.max(0, 14 - Math.round(d * 4));
  }
  eg += kingEgCenter(wKing);
  eg -= kingEgCenter(bKing);

  // tempo
  if (ch.turn() === "w") {
    mg += 10;
    eg += 5;
  } else {
    mg -= 10;
    eg -= 5;
  }

  // Taper by phase
  const PHASE_MAX = 24;
  const ph = clamp(phase, 0, PHASE_MAX);
  let score = Math.round((mg * ph + eg * (PHASE_MAX - ph)) / PHASE_MAX);

  return ch.turn() === "w" ? score : -score;
}

// ====== Quiescence search ======
function qsearch(ch, alpha, beta) {
  let stand = evalBoard(ch);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;

  const legal = ch.moves({ verbose: true });
  if (!legal.length) return -MATE;

  // Try noisy moves: captures & promotions; very few “check” tries near β
  const TRY_CHECKS = beta - stand <= 60;

  for (const mv of legal) {
    const noisy = isCapture(mv) || isPromotion(mv);
    if (!noisy && !TRY_CHECKS) continue;

    // cheap losing-capture gate
    if (isCapture(mv) && VAL[mv.captured] + 60 < (VAL[mv.piece] || 0)) continue;

    if (!noisy && TRY_CHECKS) {
      ch.move(mv);
      const givesCheck = inCheck(ch);
      ch.undo();
      if (!givesCheck) continue;
    }

    ch.move(mv);
    const sc = -qsearch(ch, -beta, -alpha);
    ch.undo();
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

// ====== Null-move helpers ======
function canNullMove(ch, depth) {
  if (depth < NULL_MIN_DEPTH) return false;
  if (inCheck(ch)) return false;

  // Require some non-pawn material for side to move to avoid zugzwang traps
  const side = ch.turn();
  const board = ch.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      if (sq.color === side && sq.type !== "p" && sq.type !== "k") return true;
    }
  }
  return false;
}
function fenNullMove(fen) {
  // FEN: board side castling ep halfmove fullmove
  const p = fen.split(" ");
  const side = p[1];
  p[1] = side === "w" ? "b" : "w";
  p[3] = "-"; // no EP after null move
  const half = (parseInt(p[4] || "0", 10) || 0) + 1;
  p[4] = String(half);
  if (side === "b") p[5] = String((parseInt(p[5] || "1", 10) || 1) + 1);
  return p.join(" ");
}

// ====== Search (PVS + LMR + extensions + pruning + null-move) ======
let stopFlag = false,
  tStart = 0,
  tBudget = 0;
function timeUp() {
  return tBudget > 0 && performance.now() - tStart >= tBudget;
}

function search(ch, depth, alpha, beta, ply) {
  // TT probe
  const key = ch.fen(); // includes side/castling/EP
  const tte = TT.get(key);
  if (tte && tte.depth >= depth) {
    const s = tte.score;
    if (tte.flag === 0) return { score: s, pv: [], best: tte.best };
    if (tte.flag === 1 && s <= alpha)
      return { score: s, pv: [], best: tte.best };
    if (tte.flag === 2 && s >= beta)
      return { score: s, pv: [], best: tte.best };
  }

  if (stopFlag || timeUp()) return { score: evalBoard(ch), pv: [], best: null };

  const inChk = inCheck(ch);

  if (depth <= 0) {
    const qs = qsearch(ch, alpha, beta);
    return { score: qs, pv: [], best: null };
  }

  // Static fail-high gate (very cheap)
  if (!inChk && depth >= STATIC_NULL_MIN_DEPTH) {
    const s = evalBoard(ch);
    if (s - STATIC_NULL_MARGIN >= beta) {
      return { score: s, pv: [], best: null };
    }
  }

  // Razoring / futility at shallow depth (skip hopeless quiet nodes)
  if (!inChk && depth === 1) {
    const s = evalBoard(ch);
    if (s + RAZOR_MARGIN <= alpha)
      return { score: qsearch(ch, alpha, beta), pv: [], best: null };
  }

  // ===== True null-move pruning =====
  if (!inChk && canNullMove(ch, depth)) {
    const R = NULL_R_BASE + Math.floor(depth / NULL_R_SCALE); // e.g., 2..3
    const nullFen = fenNullMove(ch.fen());
    const nul = new Chess(nullFen);
    const t = search(nul, depth - R - 1, -beta, -beta + 1, ply + 1);
    const score = -t.score;
    if (score >= beta) {
      return { score: score, pv: [], best: null }; // fail-high
    }
  }

  const legal0 = ch.moves({ verbose: true });
  if (!legal0.length) {
    if (inChk) return { score: -MATE + ply, pv: [], best: null };
    return { score: 0, pv: [], best: null };
  }

  let ttMove = tte?.best || null;
  let legal = orderMoves(legal0, ttMove, ply, ch);

  let origAlpha = alpha,
    bestScore = -INF,
    bestUci = null,
    bestPv = [];
  let first = true;
  let standForFutility = !inChk && depth <= 2 ? evalBoard(ch) : 0;

  for (let i = 0; i < legal.length; i++) {
    const mv = legal[i];

    // Shallow futility pruning for quiets at d<=2
    if (!inChk && !isCapture(mv) && !isPromotion(mv) && depth <= 2) {
      if (standForFutility + FUT_MARGIN <= alpha) continue;
    }

    // Make move
    ch.move(mv);
    const givesCheck = inCheck(ch);
    let d = depth - 1;

    // Extensions for tactical moves
    if (givesCheck || isPromotion(mv)) d += CHECK_EXT;

    // Late move reductions
    let reduced = false;
    if (d >= 1 && !givesCheck && !isCapture(mv) && !isPromotion(mv) && !inChk) {
      if (i >= LMR_MOVE_THRESHOLD && depth >= LMR_MIN_DEPTH) {
        const R = 1 + Math.floor(Math.log2(i + 1));
        d = Math.max(0, d - R);
        reduced = true;
      }
    }

    // PVS
    let child, sc;
    if (first) {
      child = search(ch, d, -beta, -alpha, ply + 1);
      sc = -child.score;
      first = false;
    } else {
      // narrow window
      child = search(ch, d, -alpha - 1, -alpha, ply + 1);
      sc = -child.score;
      if (sc > alpha && sc < beta) {
        // re-search
        child = search(ch, d + (reduced ? 1 : 0), -beta, -alpha, ply + 1);
        sc = -child.score;
      }
    }

    ch.undo();

    // Update best / alpha
    if (sc > bestScore) {
      bestScore = sc;
      bestUci = toUci(mv);
      bestPv = [bestUci].concat(child.pv || []);
      if (!isCapture(mv)) addHistory(mv, depth);
      if (sc > alpha) {
        alpha = sc;
        pushKiller(bestUci, ply);
      }
      if (alpha >= beta) break; // cutoff
    }

    if (stopFlag || timeUp()) break;
  }

  // TT store
  let flag = 0; // exact
  if (bestScore <= origAlpha) flag = 1;
  else if (bestScore >= beta) flag = 2;
  TT.set(key, { depth, score: bestScore, flag, best: bestUci });
  if (TT.size > TT_MAX) TT.clear();

  return { score: bestScore, pv: bestPv, best: bestUci };
}

// Root iterative deepening with aspiration windows
function analyzeRoot(fen, depth, multipv, id) {
  killers.length = 0;
  history.clear();

  const root = new Chess(fen);
  const legal = root.moves({ verbose: true });
  if (!legal.length) {
    const s = inCheck(root) ? -MATE : 0;
    return [{ firstUci: null, san: "", scoreCp: s, pv: [] }];
  }

  let scores = new Map();
  let bestSoFar = 0;
  let lines = [];

  for (let d = 1; d <= depth && !stopFlag && !timeUp(); d++) {
    let A = -INF,
      B = INF;
    if (d > 1) {
      A = bestSoFar - 50;
      B = bestSoFar + 50;
    } // aspiration

    const ordered = legal
      .slice()
      .sort(
        (a, b) =>
          (scores.get(toUci(b)) || -INF) - (scores.get(toUci(a)) || -INF),
      );
    let localBest = -INF;

    for (let i = 0; i < ordered.length && !stopFlag && !timeUp(); i++) {
      const mv = ordered[i];
      root.move(mv);

      let child = search(root, d - 1, -B, -A, 1);
      let sc = -child.score;

      if (sc <= A || sc >= B) {
        child = search(root, d - 1, -INF, INF, 1);
        sc = -child.score;
      }
      root.undo();

      scores.set(toUci(mv), sc);
      if (sc > localBest) localBest = sc;
    }
    bestSoFar = localBest;

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, multipv | 0));
    lines = [];
    for (const [uci, _sc] of ranked) {
      root.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });
      const child = search(root, Math.max(0, d - 1), -INF, INF, 1);
      root.undo();
      const pv = [uci].concat(child.pv || []);
      lines.push({
        firstUci: uci,
        scoreCp: -child.score | 0,
        pv,
        san: pvToSan(fen, pv),
      });
      if (stopFlag || timeUp()) break;
    }
    if (id !== undefined) {
      postMessage({ type: "analysis", id, lines, depth: d });
    }
  }
  return lines;
}

function pvToSan(fen, pv) {
  const ch = new Chess(fen);
  const res = [];
  for (const uci of pv) {
    ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    res.push(ch.history().slice(-1)[0]);
  }
  return res;
}

function chooseMoveForPlay(fen, depth, elo, timeMs) {
  tStart = performance.now();
  tBudget = timeMs || 0;
  stopFlag = false;
  const lines = analyzeRoot(fen, depth, 1);
  if (!lines.length || !lines[0].firstUci) return null;
  return lines[0].firstUci; // no artificial weakening
}

// ===== Worker API =====
onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === "stop") {
    stopFlag = true;
    return;
  }
  if (msg.type === "analyze") {
    tStart = performance.now();
    tBudget = msg.timeMs | 0;
    stopFlag = false;
    const depth = Math.max(1, msg.depth | 0),
      k = Math.max(1, msg.multipv | 0);
    const lines = analyzeRoot(msg.fen, depth, k, msg.id);
    postMessage({ type: "analysis", id: msg.id, lines, depth, final: true });
  } else if (msg.type === "play") {
    const d = Math.max(1, msg.depthCap | 0);
    const uci = chooseMoveForPlay(msg.fen, d, msg.elo | 0, msg.timeMs | 0);
    postMessage({ type: "bestmove", id: msg.id, uci });
  }
};
