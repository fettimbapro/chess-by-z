// src/workers/mini-engine.js
// Lightweight chess engine worker (no deps except chess.mjs). Focus: strength.

import { Chess } from '../vendor/chess.mjs';

// ===== Search tunables =====
const INF = 1e9, MATE = 1e7;
const FUT_MARGIN = 100;           // futility margin (cp)
const RAZOR_MARGIN = 200;         // razoring margin (cp)
const LMR_MOVE_THRESHOLD = 3;     // start reducing after this move index
const LMR_MIN_DEPTH = 3;
const CHECK_EXT = 1;              // +1 ply for checks/promotions
const STATIC_NULL_MARGIN = 250;   // static fail-high gate
const STATIC_NULL_MIN_DEPTH = 3;

// Null-move pruning (true null move)
const NULL_MIN_DEPTH = 3;
const NULL_R_BASE = 2;            // reduction base
const NULL_R_SCALE = 4;           // depth/scale term

// History / killers / TT
const TT = new Map();
const TT_MAX = 200000;
const killers = [];            // killers[ply] = [uci1, uci2]
const history = new Map();     // key -> score

// ===== Piece values (centipawns) =====
const VAL = { p:100, n:320, b:330, r:500, q:950, k:20000 };

// ===== Small helpers =====
const toUci = (m) => m.from + m.to + (m.promotion||'');
const isCapture = (m) => !!(m.captured || (m.flags && (m.flags.includes('c') || m.flags.includes('e'))));
const isPromotion = (m) => !!(m.promotion);
const clamp = (x,a,b)=> Math.max(a, Math.min(b, x));
const inCheck = (ch) => (ch.isCheck?.() || ch.in_check?.() || false);

function mvvLva(m){
  const cap = m.captured ? VAL[m.captured] : 0;
  const att = VAL[m.piece]||0;
  return cap*10 - att;
}
function moveKey(m){ return m.from + m.to + (m.promotion||'') + m.piece; }
function addHistory(m, d){ if (isCapture(m)) return; const k=moveKey(m); history.set(k, (history.get(k)||0) + d*d); }
function pushKiller(uci, ply){ killers[ply] = killers[ply]||[]; if (killers[ply][0]!==uci){ killers[ply][1]=killers[ply][0]; killers[ply][0]=uci; } }

function orderMoves(list, ttUci, ply, ch){
  const ks = killers[ply] || [];
  return list.map(m=>{
    let s = 0, u = toUci(m);
    if (ttUci && u===ttUci) s += 1e9;               // hash move first
    if (isCapture(m)) s += 5e8 + mvvLva(m);         // captures (MVV-LVA)
    if (isPromotion(m)) s += 4.5e8;
    // bonus for moves that give check to improve move ordering
    ch.move(m);
    if (inCheck(ch)) s += 2e8;
    ch.undo();
    if (ks[0]===u) s += 4e8;
    if (ks[1]===u) s += 3e8;
    s += (history.get(moveKey(m))||0);
    return { m, s };
  }).sort((a,b)=> b.s - a.s).map(x=>x.m);
}

// ====== Tapered Evaluation (midgame/endgame blend) ======
function manhattan(f, r){ return Math.abs(f-3.5)+Math.abs(r-3.5); }

function evalBoard(ch){
  const b = ch.board();
  let mg = 0, eg = 0;
  let phase = 0;            // 0..24 (rough PeSTO-like)
  let wb = 0, bb = 0;
  const wFiles = Array(8).fill(0), bFiles = Array(8).fill(0);
  const wPawnRanks = Array.from({length:8}, ()=>[]);
  const bPawnRanks = Array.from({length:8}, ()=>[]);
  const wRooks = [], bRooks = [];
  let wKing = null, bKing = null;

  for (let r=0;r<8;r++){
    for (let f=0; f<8; f++){
      const sq = b[r][f]; if (!sq) continue;
      const color = sq.color, type = sq.type;
      const sign = (color==='w') ? 1 : -1;

      // material
      const v = VAL[type] || 0;
      mg += sign * v; eg += sign * v;

      // phase (no pawns)
      if (type !== 'p') phase += (type==='q') ? 4 : (type==='r' ? 2 : 1);

      const rankW = 8 - r; // 1..8 from white side

      // centralization / activity (MG)
      if (type === 'n'){
        const d = manhattan(f,r);
        mg += sign * Math.max(0, 28 - Math.round(d*7));
      } else if (type === 'b'){
        const d = manhattan(f,r);
        mg += sign * Math.max(0, 22 - Math.round(d*6));
        if (color==='w') wb++; else bb++;
      } else if (type === 'q'){
        const d = manhattan(f,r);
        mg += sign * Math.max(0, 14 - Math.round(d*3));
      } else if (type === 'r'){
        // rook on 7th
        const seventh = (color==='w') ? (rankW===7) : (rankW===2);
        if (seventh) mg += sign * 18;
        if (color==='w') wRooks.push(f); else bRooks.push(f);
      } else if (type === 'k'){
        if (color==='w') wKing = {f, r}; else bKing = {f, r};
      } else if (type === 'p'){
        // track pawns for structure
        if (color==='w'){ wFiles[f]++; wPawnRanks[f].push(rankW); }
        else { bFiles[f]++; bPawnRanks[f].push(rankW); }

        // advancement
        const advW = (color==='w') ? (rankW - 2) : (7 - rankW); // 0..5
        mg += sign * advW * 5;
        eg += sign * advW * 9;
      }
    }
  }

  // bishop pair
  if (wb >= 2){ mg += 30; eg += 20; }
  if (bb >= 2){ mg -= 30; eg -= 20; }

  // doubled / isolated
  for (let f=0; f<8; f++){
    if (wFiles[f]>1){ mg -= 12 * (wFiles[f]-1); eg -= 8 * (wFiles[f]-1); }
    if (bFiles[f]>1){ mg += 12 * (bFiles[f]-1); eg += 8 * (bFiles[f]-1); }
    if (wFiles[f]){
      const neigh = (f>0?wFiles[f-1]:0) + (f<7?wFiles[f+1]:0);
      if (!neigh){ mg -= 10 * wFiles[f]; eg -= 6 * wFiles[f]; }
    }
    if (bFiles[f]){
      const neigh = (f>0?bFiles[f-1]:0) + (f<7?bFiles[f+1]:0);
      if (!neigh){ mg += 10 * bFiles[f]; eg += 6 * bFiles[f]; }
    }
  }

  // rooks on open and semi-open files
  for (const f of wRooks){
    if (wFiles[f] === 0){
      if (bFiles[f] === 0){ mg += 20; eg += 10; } // open file
      else { mg += 10; eg += 5; }                 // semi-open
    }
  }
  for (const f of bRooks){
    if (bFiles[f] === 0){
      if (wFiles[f] === 0){ mg -= 20; eg -= 10; }
      else { mg -= 10; eg -= 5; }
    }
  }

  // passed pawns
  for (let f=0; f<8; f++){
    for (const rw of wPawnRanks[f]){
      let blocked=false;
      for (let df=-1; df<=1; df++){
        const ff=f+df; if (ff<0||ff>7) continue;
        for (const rb of bPawnRanks[ff]){
          if (rb > rw) { blocked=true; break; }
        }
        if (blocked) break;
      }
      if (!blocked){
        const adv = rw - 2; // 0..5
        mg += 12 + adv*8; eg += 20 + adv*14;
      }
    }
    for (const rb of bPawnRanks[f]){
      let blocked=false;
      for (let df=-1; df<=1; df++){
        const ff=f+df; if (ff<0||ff>7) continue;
        for (const rw of wPawnRanks[ff]){
          if (rw < rb) { blocked=true; break; }
        }
        if (blocked) break;
      }
      if (!blocked){
        const adv = 7 - rb; // 0..5
        mg -= 12 + adv*8; eg -= 20 + adv*14;
      }
    }
  }

  // king safety (MG): pawn shield and exposure
  function pawnShieldScore(king, files, ranksByFile, color){
    if (!king) return 0;
    const f = king.f;
    const r1 = (color==='w') ? 2 : 7;
    const r2 = (color==='w') ? 3 : 6;
    let s = 0;
    for (let df=-1; df<=1; df++){
      const ff = f+df; if (ff<0||ff>7) continue;
      const arr = ranksByFile[ff];
      if (arr.includes(r1) || arr.includes(r2)) s++;
    }
    return s; // 0..3
  }
  const wShield = pawnShieldScore(wKing, wFiles, wPawnRanks, 'w');
  const bShield = pawnShieldScore(bKing, bFiles, bPawnRanks, 'b');
  mg += (wShield - bShield) * 16;

  function exposure(files, f0){
    let e = 0; for (let df=-1; df<=1; df++){ const ff=f0+df; if (ff<0||ff>7) continue; e += files[ff] ? 0 : 1; }
    return e;
  }
  if (wKing) mg -= exposure(wFiles, wKing.f) * 10;
  if (bKing) mg += exposure(bFiles, bKing.f) * 10;

  // king activity in endgame – encourage centralisation
  function kingEgCenter(k){
    if (!k) return 0;
    const d = manhattan(k.f, k.r);
    return Math.max(0, 14 - Math.round(d * 4));
  }
  eg += kingEgCenter(wKing);
  eg -= kingEgCenter(bKing);

  // tempo
  if (ch.turn()==='w'){ mg += 10; eg += 5; } else { mg -= 10; eg -= 5; }

  // Taper by phase
  const PHASE_MAX = 24;
  const ph = clamp(phase, 0, PHASE_MAX);
  let score = Math.round((mg * ph + eg * (PHASE_MAX - ph)) / PHASE_MAX);

  return (ch.turn() === 'w') ? score : -score;
}

// ====== Quiescence search ======
function qsearch(ch, alpha, beta){
  let stand = evalBoard(ch);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;

  const legal = ch.moves({verbose:true});
  if (!legal.length) return -MATE;

  // Try noisy moves: captures & promotions; very few “check” tries near β
  const TRY_CHECKS = (beta - stand) <= 60;

  for (const mv of legal){
    const noisy = isCapture(mv) || isPromotion(mv);
    if (!noisy && !TRY_CHECKS) continue;

    // cheap losing-capture gate
    if (isCapture(mv) && VAL[mv.captured] + 60 < (VAL[mv.piece]||0)) continue;

    if (!noisy && TRY_CHECKS){
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
function canNullMove(ch, depth){
  if (depth < NULL_MIN_DEPTH) return false;
  if (inCheck(ch)) return false;

  // Require some non-pawn material for side to move to avoid zugzwang traps
  const side = ch.turn();
  const board = ch.board();
  for (let r=0;r<8;r++){
    for (let f=0;f<8;f++){
      const sq = board[r][f];
      if (!sq) continue;
      if (sq.color === side && sq.type !== 'p' && sq.type !== 'k') return true;
    }
  }
  return false;
}
function fenNullMove(fen){
  // FEN: board side castling ep halfmove fullmove
  const p = fen.split(' ');
  const side = p[1];
  p[1] = (side === 'w') ? 'b' : 'w';
  p[3] = '-'; // no EP after null move
  const half = (parseInt(p[4]||'0',10) || 0) + 1;
  p[4] = String(half);
  if (side === 'b') p[5] = String((parseInt(p[5]||'1',10) || 1) + 1);
  return p.join(' ');
}

// ====== Search (PVS + LMR + extensions + pruning + null-move) ======
let stopFlag=false, tStart=0, tBudget=0;
function timeUp(){ return tBudget>0 && (performance.now() - tStart) >= tBudget; }

function search(ch, depth, alpha, beta, ply){
  // TT probe
  const key = ch.fen(); // includes side/castling/EP
  const tte = TT.get(key);
  if (tte && tte.depth >= depth){
    const s = tte.score;
    if (tte.flag === 0) return {score:s, pv:[], best:tte.best};
    if (tte.flag === 1 && s <= alpha) return {score:s, pv:[], best:tte.best};
    if (tte.flag === 2 && s >= beta)  return {score:s, pv:[], best:tte.best};
  }

  if (stopFlag || timeUp()) return {score:alpha, pv:[], best:null};

  const inChk = inCheck(ch);

  if (depth <= 0){
    const qs = qsearch(ch, alpha, beta);
    return {score:qs, pv:[], best:null};
  }

  // Static fail-high gate (very cheap)
  if (!inChk && depth >= STATIC_NULL_MIN_DEPTH){
    const s = evalBoard(ch);
    if (s - STATIC_NULL_MARGIN >= beta){
      return {score: s, pv:[], best:null};
    }
  }

  // Razoring / futility at shallow depth (skip hopeless quiet nodes)
  if (!inChk && depth === 1){
    const s = evalBoard(ch);
    if (s + RAZOR_MARGIN <= alpha) return {score: qsearch(ch, alpha, beta), pv:[], best:null};
  }

  // ===== True null-move pruning =====
  if (!inChk && canNullMove(ch, depth)){
    const R = NULL_R_BASE + Math.floor(depth / NULL_R_SCALE); // e.g., 2..3
    const nullFen = fenNullMove(ch.fen());
    const nul = new Chess(nullFen);
    const t = search(nul, depth - R - 1, -beta, -beta + 1, ply+1);
    const score = -t.score;
    if (score >= beta){
      return {score: score, pv:[], best:null}; // fail-high
    }
  }

  const legal0 = ch.moves({verbose:true});
  if (!legal0.length){
    if (inChk) return {score:-MATE + ply, pv:[], best:null};
    return {score:0, pv:[], best:null};
  }

  let ttMove = tte?.best || null;
  let legal = orderMoves(legal0, ttMove, ply, ch);

  let origAlpha = alpha, bestScore = -INF, bestUci = null, bestPv = [];
  let first = true;
  let standForFutility = (!inChk && depth <= 2) ? evalBoard(ch) : 0;

  for (let i=0; i<legal.length; i++){
    const mv = legal[i];

    // Shallow futility pruning for quiets at d<=2
    if (!inChk && !isCapture(mv) && !isPromotion(mv) && depth <= 2){
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
    if (d >= 1 && !givesCheck && !isCapture(mv) && !isPromotion(mv) && !inChk){
      if (i >= LMR_MOVE_THRESHOLD && depth >= LMR_MIN_DEPTH){
        const R = 1 + Math.floor(Math.log2(i+1));
        d = Math.max(0, d - R);
        reduced = true;
      }
    }

    // PVS
    let child, sc;
    if (first){
      child = search(ch, d, -beta, -alpha, ply+1);
      sc = -child.score;
      first = false;
    } else {
      // narrow window
      child = search(ch, d, -alpha-1, -alpha, ply+1);
      sc = -child.score;
      if (sc > alpha && sc < beta){
        // re-search
        child = search(ch, d + (reduced?1:0), -beta, -alpha, ply+1);
        sc = -child.score;
      }
    }

    ch.undo();

    // Update best / alpha
    if (sc > bestScore){
      bestScore = sc;
      bestUci = toUci(mv);
      bestPv = [bestUci].concat(child.pv||[]);
      if (!isCapture(mv)) addHistory(mv, depth);
      if (sc > alpha){
        alpha = sc;
        pushKiller(bestUci, ply);
      }
      if (alpha >= beta) break; // cutoff
    }

    if (stopFlag || timeUp()) break;
  }

  // TT store
  let flag = 0; // exact
  if (bestScore <= origAlpha) flag = 1; else if (bestScore >= beta) flag = 2;
  TT.set(key, {depth, score:bestScore, flag, best:bestUci});
  if (TT.size > TT_MAX) TT.clear();

  return {score:bestScore, pv:bestPv, best:bestUci};
}

// Root iterative deepening with aspiration windows
function analyzeRoot(fen, depth, multipv){
  killers.length = 0; history.clear();

  const root = new Chess(fen);
  const legal = root.moves({verbose:true});
  if (!legal.length){
    const s = (inCheck(root)) ? -MATE : 0;
    return [{firstUci:null, san:'', scoreCp:s, pv:[]}];
  }

  let scores = new Map();
  let bestSoFar = 0;

  for (let d=1; d<=depth && !stopFlag && !timeUp(); d++){
    let A = -INF, B = INF;
    if (d>1){ A = bestSoFar - 50; B = bestSoFar + 50; } // aspiration

    const ordered = legal.slice().sort((a,b)=> (scores.get(toUci(b))||-INF) - (scores.get(toUci(a))||-INF));
    let localBest = -INF;

    for (let i=0; i<ordered.length && !stopFlag && !timeUp(); i++){
      const mv = ordered[i];
      root.move(mv);

      let child = search(root, d-1, -B, -A, 1);
      let sc = -child.score;

      if (sc <= A || sc >= B){
        child = search(root, d-1, -INF, INF, 1);
        sc = -child.score;
      }
      root.undo();

      scores.set(toUci(mv), sc);
      if (sc > localBest) localBest = sc;
    }
    bestSoFar = localBest;
  }

  const ranked = [...scores.entries()].sort((a,b)=> b[1]-a[1]).slice(0, Math.max(1, multipv|0));
  const lines = [];
  for (const [uci, _sc] of ranked){
    root.move({from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4]});
    const child = search(root, Math.max(0, depth-1), -INF, INF, 1);
    root.undo();
    const pv = [uci].concat(child.pv||[]);
    lines.push({ firstUci: uci, scoreCp: -child.score|0, pv, san: pvToSan(fen, pv) });
    if (stopFlag || timeUp()) break;
  }
  return lines;
}

function pvToSan(fen, pv){
  const ch = new Chess(fen);
  const res = [];
  for (const uci of pv){
    ch.move({from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4]});
    res.push(ch.history().slice(-1)[0]);
  }
  return res;
}

function chooseMoveForPlay(fen, depth, elo, timeMs){
  tStart = performance.now(); tBudget = timeMs||0; stopFlag=false;
  const lines = analyzeRoot(fen, depth, 1);
  if (!lines.length || !lines[0].firstUci) return null;
  return lines[0].firstUci; // no artificial weakening
}

// ===== Worker API =====
onmessage = (e) => {
  const msg = e.data||{};
  if (msg.type==='stop'){ stopFlag=true; return; }
  if (msg.type==='analyze'){
    tStart = performance.now(); tBudget = msg.timeMs|0; stopFlag=false;
    const depth = Math.max(1, msg.depth|0), k = Math.max(1, msg.multipv|0);
    const lines = analyzeRoot(msg.fen, depth, k);
    postMessage({type:'analysis', id: msg.id, lines, depth});
  }
  else if (msg.type==='play'){
    const d = Math.max(1, msg.depthCap|0);
    const uci = chooseMoveForPlay(msg.fen, d, msg.elo|0, msg.timeMs|0);
    postMessage({type:'bestmove', id: msg.id, uci});
  }
};
