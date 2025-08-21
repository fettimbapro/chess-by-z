// public/src/ui/BoardUI.js
// BoardUI with:
// - Both sides use the *solid (black-piece) glyph shapes* (♚♛♜♝♞♟)
// - White pieces are white (with thin black outline); black pieces are black (with thin white outline)
// - Last-move highlights (.hl-from/.hl-to) only on real moves (skip page load / New Game)
// - In-check glow (.hl-check)
// - Click-to-move selection + legal dots; drag preserved
// - Opponent/book primary arrows ignored; all arrows cleared on setFen()

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// Use the *black* glyph codepoints for BOTH sides (solid shapes)
// Append U+FE0E (text presentation) to avoid emoji glyphs on iOS Safari
const BLACK_GLYPH = {
  k: "♚\uFE0E",
  q: "♛\uFE0E",
  r: "♜\uFE0E",
  b: "♝\uFE0E",
  n: "♞\uFE0E",
  p: "♟\uFE0E",
};

// ---------------- CSS injection ----------------
(function injectStyle() {
  if (document.getElementById("boardui-style")) return;
  const st = document.createElement("style");
  st.id = "boardui-style";
  st.textContent = `
    /* Selection & hover */
    .sq.sel { outline: 2px solid rgba(120,160,255,.9); outline-offset: -2px; }
    .sq.hover { outline: 2px dashed rgba(120,160,255,.45); outline-offset: -2px; }
    .sq.dragSource { filter: brightness(1.05); }

    /* Piece glyph (applies to board squares and the drag ghost) */
    .sq .glyph, .dragPiece.glyph {
      display: inline-block;
      line-height: 1;
      font-size: calc(var(--cell) * 0.82);
      font-family: "DejaVu Sans", "Noto Sans Symbols2", "Segoe UI Symbol", "Symbola", "FreeSerif", serif;
      font-variant-emoji: text;
      --glyph-outline-width: max(0.6px, calc(var(--cell) * 0.01));
      /* Outline color is provided via --glyph-outline (set by piece color) */
      -webkit-text-stroke: var(--glyph-outline-width) var(--glyph-outline, #000);
      /* Fallback outline using layered text-shadows (thinner than before) */
      text-shadow:
        0 var(--glyph-outline-width) var(--glyph-outline, #000),
        var(--glyph-outline-width) 0 var(--glyph-outline, #000),
        0 calc(var(--glyph-outline-width) * -1) var(--glyph-outline, #000),
        calc(var(--glyph-outline-width) * -1) 0 var(--glyph-outline, #000),
        var(--glyph-outline-width) var(--glyph-outline-width) var(--glyph-outline, #000),
        var(--glyph-outline-width) calc(var(--glyph-outline-width) * -1) var(--glyph-outline, #000),
        calc(var(--glyph-outline-width) * -1) var(--glyph-outline-width) var(--glyph-outline, #000),
        calc(var(--glyph-outline-width) * -1)
          calc(var(--glyph-outline-width) * -1)
          var(--glyph-outline, #000);
      pointer-events: none;
      user-select: none;
    }
    /* Make bishops slightly larger to distinguish from pawns */
    .sq .glyph.piece-b,
    .dragPiece.glyph.piece-b {
      font-size: calc(var(--cell) * 0.88);
    }
    /* Make kings and queens larger for easier identification */
    .sq .glyph.piece-k,
    .dragPiece.glyph.piece-k,
    .sq .glyph.piece-q,
    .dragPiece.glyph.piece-q {
      font-size: calc(var(--cell) * 0.94);
    }
    /* Inverted outlines + fill color per side */
    .sq.pw .glyph { color: #fff; }       /* white piece: white fill */
    .sq.pb .glyph { color: #0b0b0b; }    /* black piece: black fill */
    .sq.pw { --glyph-outline: #000; }    /* white piece gets black outline */
    .sq.pb { --glyph-outline: #fff; --glyph-outline-width: max(0.1px, calc(var(--cell) * 0.003)); }    /* black piece gets white outline */

    /* Drag ghost adopts same rules by adding .pw/.pb on the ghost element */
    .dragPiece.glyph.pw { --glyph-outline: #000; color: #fff; }
    .dragPiece.glyph.pb { --glyph-outline: #fff; color: #0b0b0b; --glyph-outline-width: max(0.1px, calc(var(--cell) * 0.003)); }

    /* Legal move dots */
    .sq .dot {
      width: calc(var(--cell, 48px) * .28);
      height: calc(var(--cell, 48px) * .28);
      border-radius: 50%;
      background: radial-gradient(closest-side, rgba(120,160,255,.6), rgba(120,160,255,0));
      pointer-events: none;
    }
    .sq.dark .dot { filter: brightness(1.15); }
    .sq .dot.cap {
      width: calc(var(--cell, 48px) * .42);
      height: calc(var(--cell, 48px) * .42);
      border: 3px solid rgba(120,160,255,.55);
      background: transparent;
    }

    /* Last move, check, and premove highlights */
    .sq.hl-from::after, .sq.hl-to::after, .sq.hl-check::after,
    .sq.hl-premove-from::after, .sq.hl-premove-to::after,
    .sq.hl-hint::after {
      content: ''; position: absolute; inset: 2px; border-radius: 6px; pointer-events: none;
    }
    .sq.hl-from::after      { box-shadow: inset 0 0 0 3px rgba(120,170,255,.35), 0 0 12px 4px rgba(120,170,255,.18); }
    .sq.hl-to::after        { box-shadow: inset 0 0 0 3px rgba(120,170,255,.5),  0 0 14px 6px rgba(120,170,255,.22); }
    .sq.hl-check::after     { box-shadow: inset 0 0 0 3px rgba(255,70,70,.50),   0 0 18px 10px rgba(255,70,70,.25); }
    .sq.hl-premove-from::after { box-shadow: inset 0 0 0 3px rgba(200,120,255,.35), 0 0 12px 4px rgba(200,120,255,.18); }
    .sq.hl-premove-to::after   { box-shadow: inset 0 0 0 3px rgba(200,120,255,.5),  0 0 14px 6px rgba(200,120,255,.22); }
    .sq.hl-hint::after      { box-shadow: inset 0 0 0 3px rgba(255,215,0,.55), 0 0 14px 6px rgba(255,215,0,.25); }

    .sq { position: relative; }
    .sq:active { filter: none !important; }

    /* Analysis arrows (we clear them on setFen) */
    svg#arrowSvg g.analysis line.arrow { stroke-width: 6; stroke-linecap: round; opacity: .9; }
    svg#arrowSvg g.analysis polygon.head { opacity: .95; }

    /* Celebration confetti */
    .confetti-root { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:5; }
    .confetti-piece {
      position:absolute;
      width:12px; height:12px;
      opacity:.95;
      transform: translate(-50%, -50%);
      animation: confetti-explode 1.2s ease-out forwards;
    }
    @keyframes confetti-explode {
      to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))); opacity:0; }
    }
  `;
  document.head.appendChild(st);
})();

// ---------------- FEN & helpers ----------------
function parseFenPieces(fen) {
  const out = {};
  if (!fen || typeof fen !== "string") return { pos: out, turn: "w" };
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0]?.split("/") || [];
  const turn = parts[1] === "b" ? "b" : "w";
  let r = 8;
  for (const row of rows) {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += parseInt(ch, 10);
        continue;
      }
      const color = ch === ch.toUpperCase() ? "w" : "b";
      const typeMap = { p: "p", n: "n", b: "b", r: "r", q: "q", k: "k" };
      const type = typeMap[ch.toLowerCase()] || "p";
      const sq = `${FILES[f]}${r}`;
      out[sq] = { color, type };
      f++;
    }
    r--;
  }
  return { pos: out, turn };
}

function sqToXY(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = parseInt(sq[1], 10) - 1;
  return [f, r];
}
function onBoard(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

function isSquareAttacked(pos, targetSq, byColor) {
  const occ = {};
  for (const [sq, p] of Object.entries(pos)) occ[sq] = p;

  const [tf, tr] = sqToXY(targetSq);

  const dirsB = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const dirsR = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const ray = (dirs, types) => {
    for (const [df, dr] of dirs) {
      let f = tf + df,
        r = tr + dr;
      while (onBoard(f, r)) {
        const sq = `${FILES[f]}${r + 1}`;
        const p = occ[sq];
        if (p) {
          if (p.color === byColor && (types.includes(p.type) || p.type === "q"))
            return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
    return false;
  };
  if (ray(dirsB, ["b"])) return true;
  if (ray(dirsR, ["r"])) return true;

  const ks = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];
  for (const [df, dr] of ks) {
    const f = tf + df,
      r = tr + dr;
    if (!onBoard(f, r)) continue;
    const sq = `${FILES[f]}${r + 1}`;
    const p = occ[sq];
    if (p && p.color === byColor && p.type === "n") return true;
  }

  const dir = byColor === "w" ? 1 : -1;
  for (const df of [-1, 1]) {
    const f = tf + df,
      r = tr - dir;
    if (!onBoard(f, r)) continue;
    const sq = `${FILES[f]}${r + 1}`;
    const p = occ[sq];
    if (p && p.color === byColor && p.type === "p") return true;
  }

  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = tf + df,
        r = tr + dr;
      if (!onBoard(f, r)) continue;
      const sq = `${FILES[f]}${r + 1}`;
      const p = occ[sq];
      if (p && p.color === byColor && p.type === "k") return true;
    }
  }
  return false;
}

function findKingSquare(pos, color) {
  for (const [sq, p] of Object.entries(pos)) {
    if (p.type === "k" && p.color === color) return sq;
  }
  return null;
}

// --------------- BoardUI -----------------
export class BoardUI {
  constructor({
    boardEl,
    arrowSvg = null,
    promoEl = null,
    onUserMove = null,
    getPieceAt = null,
    getLegalTargets = null,
    cancelPreMove = null,
  }) {
    this.boardEl = boardEl;
    this.arrowSvg = arrowSvg || boardEl.querySelector("#arrowSvg") || null;
    this.promoEl = promoEl;
    this.onUserMove = onUserMove || (() => true);
    this.getPieceAt = getPieceAt || (() => null);
    this.getLegalTargets = getLegalTargets || (() => []);
    this.cancelPreMove = cancelPreMove || (() => false);

    this.orientation = "white";
    this.fen = "startpos";

    // interaction
    this.selected = null;
    this.dragTargets = new Set();
    this.dragStart = null;
    this.dragStarted = false;
    this.dragGhost = null;
    this.hoverSq = null;

    // celebration state
    this._celebrationRoot = null;
    this._celebrationTimer = null;

    // last move
    this._lastFrom = null;
    this._lastTo = null;
    this._lastUci = null; // 'e2e4'

    // premove highlight
    this._preFrom = null;
    this._preTo = null;
    this._preJustQueued = null;

    // position cache
    this._pos = {};
    this._turn = "w";

    this._rafHandle = 0;
    this._pendingEvt = null;

    // arrow layers
    this.gSys = null; // if present (from DrawOverlay)
    this.gAnalysis = null; // analysis layer we own

    // user drawings (no-ops)
    this._userArrows = [];
    this._userCircles = [];

    this.ensureSquares();
    this.ensureOverlayGroups();
    this.updateMetrics();
    this.attachLeftDrag();
    this.attachClick();

    window.addEventListener("resize", () => {
      this.updateMetrics();
      this.resizeOverlayViewBox();
    });
    this.resizeOverlayViewBox();
  }

  // ---------- DOM creation ----------
  ensureSquares() {
    let overlay = null;
    if (this.arrowSvg && this.arrowSvg.parentElement === this.boardEl) {
      overlay = this.arrowSvg;
    }
    const needBuild = this.boardEl.querySelectorAll(".sq").length !== 64;
    if (needBuild) {
      this.boardEl.innerHTML = "";
      const frag = document.createDocumentFragment();
      for (let r = 8; r >= 1; r--) {
        for (let f = 0; f < 8; f++) {
          const sq = `${FILES[f]}${r}`;
          const el = document.createElement("div");
          el.className = `sq ${(f + r) % 2 === 0 ? "light" : "dark"}`;
          el.dataset.square = sq;
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          frag.appendChild(el);
        }
      }
      this.boardEl.appendChild(frag);

      // drag ghost
      this.dragGhost = document.createElement("div");
      this.dragGhost.className = "dragPiece";
      this.dragGhost.style.position = "absolute";
      this.dragGhost.style.pointerEvents = "none";
      this.dragGhost.style.transform = "translate(-9999px,-9999px)";
      this.dragGhost.style.display = "none";
      this.boardEl.appendChild(this.dragGhost);
    } else {
      this.dragGhost = this.boardEl.querySelector(".dragPiece") || null;
    }

    if (overlay) {
      this.boardEl.appendChild(overlay);
      this.arrowSvg = overlay;
    }

    const cs = getComputedStyle(this.boardEl);
    if (!cs.display || cs.display === "block") {
      this.boardEl.style.display = "grid";
      this.boardEl.style.gridTemplateColumns = "repeat(8, 1fr)";
      this.boardEl.style.aspectRatio = "1 / 1";
      this.boardEl.style.userSelect = "none";
      this.boardEl.style.position =
        cs.position === "static" ? "relative" : cs.position;
      this.boardEl.style.fontSize = "calc(min(9vmin, 56px))";
    }
  }

  ensureOverlayGroups() {
    if (!this.arrowSvg) return;
    this.gSys = this.arrowSvg.querySelector("g.sys-arrows") || null;
    let gAna = this.arrowSvg.querySelector("g.analysis");
    if (!gAna) {
      gAna = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gAna.setAttribute("class", "analysis");
      this.arrowSvg.appendChild(gAna);
    }
    this.gAnalysis = gAna;
  }

  resizeOverlayViewBox() {
    if (!this.arrowSvg) return;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.arrowSvg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  }

  updateMetrics() {
    const r = this.boardEl.getBoundingClientRect();
    this.size = Math.min(r.width || 0, r.height || 0);
    this.cell = (this.size || 0) / 8 || 0;
    this.boardEl.style.setProperty("--cell", `${this.cell}px`);
  }

  // ---------- Board API ----------
  setFen(fen) {
    this.fen = fen || "startpos";
    const { pos, turn } = parseFenPieces(this.fen);
    const prev = this._pos || {};
    const next = pos;

    // update pos/turn and re-render
    this._pos = next;
    this._turn = turn;
    this.renderPosition();

    // Clear any arrows (prevents stuck book/engine arrows)
    this.clearArrow();
    this.clearSysArrows();

    // Diff and highlight only on genuine move; skip on large resets
    const diff = this._diffAddsRems(prev, next);
    const changedCount = diff.changed;
    const hasMove = diff.added.length > 0 && diff.removed.length > 0;

    if (changedCount < 8 && hasMove) {
      this.applyLastMoveFromDiff(diff);
    } else {
      this._clearLastMoveHl();
    }

    this.applyCheckHighlight(next, turn);
  }

  setOrientation(side) {
    this.orientation = side === "black" ? "black" : "white";
    this.renderPosition();
  }
  flip() {
    this.setOrientation(this.orientation === "white" ? "black" : "white");
  }

  // ---------- Rendering ----------
  renderPosition() {
    const pos = this._pos;
    const squares = this.boardEl.querySelectorAll(".sq");
    let idx = 0;
    for (let rank = 8; rank >= 1; rank--) {
      for (let file = 0; file < 8; file++, idx++) {
        const sq =
          this.orientation === "white"
            ? `${FILES[file]}${rank}`
            : `${FILES[7 - file]}${9 - rank}`;
        const el = squares[idx];
        el.dataset.square = sq;
        const piece = pos[sq];

        // clear
        el.innerHTML = "";
        el.classList.remove(
          "pw",
          "pb",
          "sel",
          "cap",
          "hover",
          "dragSource",
          "hl-from",
          "hl-to",
          "hl-check",
        );
        el.removeAttribute("data-piece");
        const dot = el.querySelector?.(".dot");
        if (dot) dot.remove();

        if (piece) {
          // Solid glyph for both sides
          const glyph = BLACK_GLYPH[piece.type];
          const span = document.createElement("span");
          span.className = `glyph piece-${piece.type}`;
          span.textContent = glyph;
          el.appendChild(span);

          // piece color informs fill + outline via CSS
          el.classList.add(piece.color === "w" ? "pw" : "pb");
          el.setAttribute("data-piece", `${piece.color}${piece.type}`);
        }
      }
    }
    this.resizeOverlayViewBox();
  }

  // ---------- Diff / Highlights ----------
  _diffAddsRems(prev, next) {
    const added = [],
      removed = [];
    let changed = 0;

    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = `${FILES[f]}${r}`;
        const a = prev[sq] || null;
        const b = next[sq] || null;
        if (a?.type !== b?.type || a?.color !== b?.color) {
          changed++;
          if (!a && b) added.push({ sq, p: b });
          else if (a && !b) removed.push({ sq, p: a });
          else if (a && b) {
            removed.push({ sq, p: a });
            added.push({ sq, p: b });
          }
        }
      }
    }
    return { added, removed, changed };
  }

  _clearLastMoveHl() {
    if (this._lastFrom)
      this.squareEl(this._lastFrom)?.classList?.remove("hl-from");
    if (this._lastTo) this.squareEl(this._lastTo)?.classList?.remove("hl-to");
    this._lastFrom = this._lastTo = this._lastUci = null;
  }

  applyLastMoveFromDiff({ added, removed }) {
    this._clearLastMoveHl();
    if (!(added && removed) || added.length === 0 || removed.length === 0)
      return;

    // Prefer king move if present (castling), else take first pair.
    let fromSq = removed[0].sq;
    let toSq = added[0].sq;
    const kingAdd = added.find((x) => x.p.type === "k");
    const kingRem = removed.find((x) => x.p.type === "k");
    if (kingAdd && kingRem) {
      fromSq = kingRem.sq;
      toSq = kingAdd.sq;
    }

    if (fromSq) {
      this.squareEl(fromSq)?.classList?.add("hl-from");
      this._lastFrom = fromSq;
    }
    if (toSq) {
      this.squareEl(toSq)?.classList?.add("hl-to");
      this._lastTo = toSq;
    }

    if (this._lastFrom && this._lastTo) {
      this._lastUci = this._lastFrom + this._lastTo; // 4-char UCI
    }
  }

  applyCheckHighlight(pos, turn) {
    // Clear any prior check
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        this.squareEl(`${FILES[f]}${r}`)?.classList?.remove("hl-check");
      }
    }
    const kingSq = findKingSquare(pos, turn);
    if (!kingSq) return;
    const attacker = turn === "w" ? "b" : "w";
    const inCheck = isSquareAttacked(pos, kingSq, attacker);
    if (inCheck) {
      this.squareEl(kingSq)?.classList?.add("hl-check");
    }
  }

  // ---------- Arrows ----------
  // Ignore opponent/book primary arrows entirely.
  drawArrowUci(uci, isPrimary) {
    if (isPrimary) return;
    if (!this.gAnalysis) this.ensureOverlayGroups();
    if (!this.gAnalysis) return;

    const u4 = (uci || "").slice(0, 4);
    const from = u4.slice(0, 2),
      to = u4.slice(2, 4);
    const { x: x1, y: y1 } = this.squareCenterPx(from);
    const { x: x2, y: y2 } = this.squareCenterPx(to);
    this._drawAnalysisArrow(x1, y1, x2, y2, /*primary=*/ false);
  }

  clearArrow() {
    if (!this.gAnalysis) this.ensureOverlayGroups();
    if (!this.gAnalysis) return;
    while (this.gAnalysis.firstChild)
      this.gAnalysis.removeChild(this.gAnalysis.firstChild);
  }

  clearSysArrows() {
    if (!this.arrowSvg) return;
    const gSys = this.arrowSvg.querySelector("g.sys-arrows");
    if (!gSys) return;
    while (gSys.firstChild) gSys.removeChild(gSys.firstChild);
  }

  _drawAnalysisArrow(x1, y1, x2, y2, primary) {
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    const line = document.createElementNS(ns, "line");
    line.setAttribute("class", "arrow");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute(
      "stroke",
      primary ? "rgba(120,170,255,.95)" : "rgba(120,170,255,.65)",
    );
    this.gAnalysis.appendChild(g);
    g.appendChild(line);

    const dx = x2 - x1,
      dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len,
      uy = dy / len;
    const headLen = Math.max(10, this.cell * 0.35);
    const baseX = x2 - ux * headLen,
      baseY = y2 - uy * headLen;
    const leftX = baseX + -uy * (headLen * 0.6);
    const leftY = baseY + ux * (headLen * 0.6);
    const rightX = baseX - -uy * (headLen * 0.6);
    const rightY = baseY - ux * (headLen * 0.6);
    const head = document.createElementNS(ns, "polygon");
    head.setAttribute("class", "head");
    head.setAttribute(
      "points",
      `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`,
    );
    head.setAttribute(
      "fill",
      primary ? "rgba(120,170,255,.95)" : "rgba(120,170,255,.65)",
    );
    g.appendChild(head);
  }

  // ---------- User drawings API (no-ops) ----------
  clearUserArrows() {
    this._userArrows = [];
  }
  clearUserCircles() {
    this._userCircles = [];
  }
  getUserDrawings() {
    return {
      arrows: this._userArrows.slice(),
      circles: this._userCircles.slice(),
    };
  }
  setUserDrawings(obj) {
    const a = Array.isArray(obj?.arrows) ? obj.arrows : [];
    const c = Array.isArray(obj?.circles) ? obj.circles : [];
    this._userArrows = a;
    this._userCircles = c;
  }

  // ---------- Interaction ----------
  attachLeftDrag() {
    if (!window.PointerEvent) {
      return;
    }
    const onDown = (e) => {
      if (e.button !== 0 || (e.ctrlKey && !e.metaKey)) return;
      const sqEl = e.target.closest(".sq");
      if (!sqEl) return;
      const from = sqEl.dataset.square;
      const piece = this.getPieceAt(from);
      const targets = new Set(this.getLegalTargets(from) || []);
      if (!piece || targets.size === 0) return;

      e.preventDefault();
      try {
        this.boardEl.setPointerCapture(e.pointerId);
      } catch {}

      // Drag ghost uses black glyph too; color/outline set by .pw/.pb class on the ghost
      this.dragStart = {
        x0: e.clientX,
        y0: e.clientY,
        from,
        glyph: BLACK_GLYPH[piece.type],
        color: piece.color,
        type: piece.type,
      };
      this.dragStarted = false;
      this.dragTargets = targets;
      this.selected = from;
      this.clearSelectionDots();
      this.markSelected(from, this.dragTargets);

      sqEl.classList.add("dragSource");

      const move = (ev) => this.onPointerMove(ev);
      const up = (ev) => {
        this.boardEl.removeEventListener("pointermove", move);
        this.boardEl.removeEventListener("pointerup", up);
        this.onPointerUp(ev);
      };
      this.boardEl.addEventListener("pointermove", move);
      this.boardEl.addEventListener("pointerup", up);
    };
    this.boardEl.addEventListener("pointerdown", onDown);
  }

  onPointerMove(e) {
    if (!this.dragStart) return;

    if (!this.dragStarted) {
      const dx = e.clientX - this.dragStart.x0;
      const dy = e.clientY - this.dragStart.y0;
      if (dx * dx + dy * dy < 9) return;
      this.dragStarted = true;
      if (this.dragGhost) {
        this.dragGhost.textContent = this.dragStart.glyph;
        this.dragGhost.classList.add(
          "glyph",
          this.dragStart.color === "w" ? "pw" : "pb",
          `piece-${this.dragStart.type}`,
        );
        this.dragGhost.style.display = "flex";
      }
    }

    this._pendingEvt = e;
    if (this._rafHandle) return;
    this._rafHandle = requestAnimationFrame(() => {
      const ev = this._pendingEvt;
      this._pendingEvt = null;
      this._rafHandle = 0;
      if (!ev) return;
      const { left, top } = this.boardEl.getBoundingClientRect();
      const x = ev.clientX - left,
        y = ev.clientY - top;
      if (this.dragGhost) {
        const scale = this.dragStart?.type === "b" ? 0.88 : 0.82;
        this.dragGhost.style.fontSize = `calc(var(--cell) * ${scale})`;
        this.dragGhost.style.transform = `translate(${x - this.cell / 2}px, ${y - this.cell / 2}px)`;
      }
      const sq = this.squareFromXY(x, y);
      if (this.hoverSq && this.hoverSq !== sq)
        this.squareEl(this.hoverSq)?.classList?.remove("hover");
      this.hoverSq = sq;
      this.squareEl(sq)?.classList?.add("hover");
    });
  }

  onPointerUp(e) {
    try {
      this.boardEl.releasePointerCapture(e.pointerId);
    } catch {}
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = 0;
    }
    if (this.dragGhost) {
      this.dragGhost.style.display = "none";
      this.dragGhost.style.transform = "translate(-9999px,-9999px)";
      this.dragGhost.classList.remove(
        "pw",
        "pb",
        "piece-p",
        "piece-n",
        "piece-b",
        "piece-r",
        "piece-q",
        "piece-k",
      );
    }
    if (this.hoverSq) {
      this.squareEl(this.hoverSq)?.classList?.remove("hover");
      this.hoverSq = null;
    }

    const from = this.dragStart?.from;
    const started = this.dragStarted;
    this.dragStart = null;
    this.dragStarted = false;

    if (from) this.squareEl(from)?.classList?.remove("dragSource");

    if (!started) {
      return;
    } // click handled in attachClick

    const { left, top } = this.boardEl.getBoundingClientRect();
    const x = e.clientX - left,
      y = e.clientY - top;
    const to = this.squareFromXY(x, y);
    if (!from || !to || from === to || !this.dragTargets.has(to)) return;

    const piece = this.getPieceAt(from);
    if (piece?.type === "p" && (to[1] === "8" || to[1] === "1")) {
      this.promptPromotion(from, to, piece.color);
    } else {
      const ok = this.onUserMove({ from, to });
      if (ok) {
        this.clearSelectionDots();
        this.selected = null;
      }
    }
  }

  promptPromotion(from, to, color) {
    if (!this.promoEl) {
      const ok = this.onUserMove({ from, to, promotion: "q" });
      if (ok) {
        this.clearSelectionDots();
        this.selected = null;
      }
      return;
    }
    const opts = this.promoEl.querySelectorAll(".opt");
    opts.forEach((el) => {
      el.classList.remove("pw", "pb");
      el.classList.add(color === "w" ? "pw" : "pb");
      const piece = el.dataset.piece;
      el.textContent = BLACK_GLYPH[piece];
    });
    this.promoEl.style.display = "flex";
    const handler = (ev) => {
      const opt = ev.target.closest(".opt");
      if (!opt) return;
      const piece = opt.dataset.piece;
      this.promoEl.style.display = "none";
      this.promoEl.removeEventListener("click", handler);
      const ok = this.onUserMove({ from, to, promotion: piece });
      if (ok) {
        this.clearSelectionDots();
        this.squareEl(from)?.classList?.remove("sel");
        this.selected = null;
      }
    };
    this.promoEl.addEventListener("click", handler, { once: true });
  }

  attachClick() {
    // Click-to-move
    this.boardEl.addEventListener("click", (e) => {
      const now = performance.now();
      if (this._preJustQueued && now - this._preJustQueued < 100) {
        this._preJustQueued = null;
        return;
      }
      this._preJustQueued = null;
      if (this.cancelPreMove?.()) return;
      const sqEl = e.target.closest(".sq");
      if (!sqEl) return;
      const sq = sqEl.dataset.square;
      const piece = this.getPieceAt(sq);

      if (this.selected === sq) {
        this.clearSelectionDots();
        this.squareEl(this.selected)?.classList?.remove("sel");
        this.dragTargets.clear();
        this.selected = null;
        return;
      }

      // Move if selected and target is legal
      if (this.selected && this.dragTargets.has(sq)) {
        const pieceSel = this.getPieceAt(this.selected);
        if (pieceSel?.type === "p" && (sq[1] === "8" || sq[1] === "1")) {
          this.promptPromotion(this.selected, sq, pieceSel.color);
        } else {
          const ok = this.onUserMove({ from: this.selected, to: sq });
          if (ok) {
            this.clearSelectionDots();
            this.squareEl(this.selected)?.classList?.remove("sel");
            this.selected = null;
          }
        }
        return;
      }

      // (Re)select piece only if it has legal moves, else clear
      if (piece) {
        const targets = new Set(this.getLegalTargets(sq) || []);
        if (targets.size) {
          if (this.selected)
            this.squareEl(this.selected)?.classList?.remove("sel");
          this.selected = sq;
          this.dragTargets = targets;
          this.clearSelectionDots();
          this.markSelected(sq, this.dragTargets);
        } else {
          if (this.selected)
            this.squareEl(this.selected)?.classList?.remove("sel");
          this.clearSelectionDots();
          this.selected = null;
        }
      } else {
        if (this.selected)
          this.squareEl(this.selected)?.classList?.remove("sel");
        this.clearSelectionDots();
        this.selected = null;
      }
    });
  }

  markSelected(from, targets) {
    const el = this.squareEl(from);
    el?.classList?.add("sel");
    targets.forEach((t) => {
      const tEl = this.squareEl(t);
      if (!tEl) return;
      const cap = tEl.classList.contains("pw") || tEl.classList.contains("pb");
      const dot = document.createElement("div");
      dot.className = "dot" + (cap ? " cap" : "");
      tEl.appendChild(dot);
    });
  }

  clearSelectionDots() {
    this.boardEl
      .querySelectorAll(".sq.sel")
      .forEach((el) => el.classList.remove("sel"));
    this.boardEl.querySelectorAll(".sq .dot").forEach((el) => el.remove());
  }

  markPreMove(from, to) {
    this.clearPreMove();
    this._preFrom = from;
    this._preTo = to;
    this._preJustQueued = performance.now();
    this.squareEl(from)?.classList?.add("hl-premove-from");
    this.squareEl(to)?.classList?.add("hl-premove-to");
  }

  clearPreMove() {
    if (this._preFrom)
      this.squareEl(this._preFrom)?.classList?.remove("hl-premove-from");
    if (this._preTo)
      this.squareEl(this._preTo)?.classList?.remove("hl-premove-to");
    this._preFrom = this._preTo = null;
    this._preJustQueued = null;
  }

  // ---------- Utils ----------
  squareEl(sq) {
    return this.boardEl.querySelector(`.sq[data-square="${sq}"]`);
  }

  squareCenterPx(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10) - 1;
    let x, y;
    if (this.orientation === "white") {
      x = (f + 0.5) * this.cell;
      y = (7 - r + 0.5) * this.cell;
    } else {
      x = (7 - f + 0.5) * this.cell;
      y = (r + 0.5) * this.cell;
    }
    return { x, y };
  }

  squareFromXY(x, y) {
    const size = Math.min(this.boardEl.clientWidth, this.boardEl.clientHeight);
    const cell = size / 8;
    let f = Math.floor(x / cell);
    let r = 7 - Math.floor(y / cell); // y down -> rank up
    if (this.orientation === "black") {
      f = 7 - f;
      r = 7 - r;
    }
    f = Math.max(0, Math.min(7, f));
    r = Math.max(0, Math.min(7, r));
    return `${FILES[f]}${r + 1}`;
  }

  // -------- celebration --------
  celebrate(square) {
    // remove any existing celebration
    this.stopCelebration();

    const root = document.createElement("div");
    root.className = "confetti-root";
    this.boardEl.appendChild(root);

    const origin = square
      ? this.squareCenterPx(square)
      : { x: this.boardEl.clientWidth / 2, y: this.boardEl.clientHeight / 2 };
    const colors = ["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6"];
    for (let i = 0; i < 200; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = `${origin.x}px`;
      piece.style.top = `${origin.y}px`;
      piece.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * 160;
      piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      piece.style.animationDelay = (Math.random() * 0.2).toFixed(2) + "s";
      root.appendChild(piece);
    }

    this._celebrationRoot = root;
    this._celebrationTimer = setTimeout(() => this.stopCelebration(), 1500);
  }

  stopCelebration() {
    if (this._celebrationTimer) {
      clearTimeout(this._celebrationTimer);
      this._celebrationTimer = null;
    }
    if (this._celebrationRoot) {
      this._celebrationRoot.remove();
      this._celebrationRoot = null;
    }
  }
}
