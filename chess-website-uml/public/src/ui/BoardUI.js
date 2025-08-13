// public/src/ui/BoardUI.js
// BoardUI with built-in highlights and selection UX.
// - Borderless from/to highlights for last move (.hl-from, .hl-to)
// - King-in-check highlight (.hl-check) for the side currently in check
// - Click-to-move selection darkening (.sel) + legal move dots (.dot)
// - Drag-and-drop preserved (uses Pointer Events)
// - Self-injected CSS — no external CSS edits required
//
// Exposed constructor options remain the same as before.
const FILES = ['a','b','c','d','e','f','g','h'];

// Unicode glyphs (CSS may override)
const GLYPH = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

// ---------------- CSS injection ----------------
(function injectStyle(){
  if (document.getElementById('boardui-style')) return;
  const st = document.createElement('style');
  st.id = 'boardui-style';
  st.textContent = `
    /* Selection & hover */
    .sq.sel { outline: 2px solid rgba(120,160,255,.9); outline-offset: -2px; }
    .sq.hover { outline: 2px dashed rgba(120,160,255,.45); outline-offset: -2px; }
    .sq.dragSource { filter: brightness(1.05); }

    /* Legal move dots */
    .sq .dot { width: calc(var(--cell, 48px) * .28); height: calc(var(--cell, 48px) * .28);
      border-radius: 50%; background: radial-gradient(closest-side, rgba(120,160,255,.6), rgba(120,160,255,0));
      pointer-events: none; }
    .sq.dark .dot { filter: brightness(1.15); }
    .sq .dot.cap { width: calc(var(--cell, 48px) * .42); height: calc(var(--cell, 48px) * .42);
      border: 3px solid rgba(120,160,255,.55); background: transparent; }

    /* Last move highlights */
    .sq.hl-from::after, .sq.hl-to::after, .sq.hl-check::after {
      content: ''; position: absolute; inset: 2px; border-radius: 6px; pointer-events: none;
    }
    .sq.hl-from::after { box-shadow: inset 0 0 0 3px rgba(120,170,255,.35), 0 0 12px 4px rgba(120,170,255,.18); }
    .sq.hl-to::after   { box-shadow: inset 0 0 0 3px rgba(120,170,255,.5),  0 0 14px 6px rgba(120,170,255,.22); }
    .sq.hl-check::after{ box-shadow: inset 0 0 0 3px rgba(255,70,70,.50),   0 0 18px 10px rgba(255,70,70,.25); }

    /* Ensure squares are positioned for pseudo elements */
    .sq { position: relative; }

    /* Avoid random darkening on clicks: don't rely on :active */
    .sq:active { filter: none !important; }
  `;
  document.head.appendChild(st);
})();

// ---------------- FEN & helpers ----------------
function parseFenPieces(fen){
  // returns map: { 'e4': {color:'w',type:'p'}, ... }, and side to move
  const out = {};
  if (!fen || typeof fen !== 'string') return { pos: out, turn: 'w' };
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0]?.split('/') || [];
  const turn = (parts[1] === 'b') ? 'b' : 'w';
  let r = 8;
  for (const row of rows){
    let f = 0;
    for (const ch of row){
      if (/\d/.test(ch)){ f += parseInt(ch,10); continue; }
      const color = (ch === ch.toUpperCase()) ? 'w' : 'b';
      const typeMap = { p:'p', n:'n', b:'b', r:'r', q:'q', k:'k' };
      const type = typeMap[ch.toLowerCase()] || 'p';
      const sq = `${FILES[f]}${r}`;
      out[sq] = { color, type };
      f++;
    }
    r--;
  }
  return { pos: out, turn };
}

function sqToXY(sq){
  const f = FILES.indexOf(sq[0]);
  const r = parseInt(sq[1],10) - 1;
  return [f, r];
}
function onBoard(f, r){ return f>=0 && f<8 && r>=0 && r<8; }

function isSquareAttacked(pos, targetSq, byColor){
  // Minimal attack detection; enough to highlight check.
  // Build quick index
  const occ = {};
  for (const [sq,p] of Object.entries(pos)) occ[sq] = p;

  const [tf, tr] = sqToXY(targetSq);

  // Directions
  const dirsB = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const dirsR = [[1,0],[-1,0],[0,1],[0,-1]];

  // Scan rays for bishops/rooks/queens
  const ray = (dirs, types)=>{
    for (const [df,dr] of dirs){
      let f=tf+df, r=tr+dr;
      while (onBoard(f,r)){
        const sq = `${FILES[f]}${r+1}`;
        const p = occ[sq];
        if (p){
          if (p.color===byColor && (types.includes(p.type) || p.type==='q')) return true;
          break;
        }
        f+=df; r+=dr;
      }
    }
    return false;
  };
  if (ray(dirsB, ['b'])) return true;
  if (ray(dirsR, ['r'])) return true;

  // Knights
  const ks = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  for (const [df,dr] of ks){
    const f=tf+df, r=tr+dr; if (!onBoard(f,r)) continue;
    const sq = `${FILES[f]}${r+1}`;
    const p = occ[sq]; if (p && p.color===byColor && p.type==='n') return true;
  }

  // Pawns
  const dir = (byColor==='w') ? 1 : -1; // white attacks up (r+1)
  for (const df of [-1,1]){
    const f=tf+df, r=tr-dir; // attacker must be one rank behind target
    if (!onBoard(f,r)) continue;
    const sq = `${FILES[f]}${r+1}`;
    const p = occ[sq]; if (p && p.color===byColor && p.type==='p') return true;
  }

  // King (adjacent)
  for (let df=-1; df<=1; df++){
    for (let dr=-1; dr<=1; dr++){
      if (!df && !dr) continue;
      const f=tf+df, r=tr+dr; if (!onBoard(f,r)) continue;
      const sq = `${FILES[f]}${r+1}`;
      const p = occ[sq]; if (p && p.color===byColor && p.type==='k') return true;
    }
  }

  return false;
}

function findKingSquare(pos, color){
  for (const [sq,p] of Object.entries(pos)){ if (p.type==='k' && p.color===color) return sq; }
  return null;
}

// --------------- BoardUI -----------------
export class BoardUI {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.boardEl
   * @param {SVGElement} [opts.arrowSvg]
   * @param {HTMLElement} [opts.promoEl]
   * @param {(mv:{from:string,to:string,promotion?:'q'|'r'|'b'|'n'})=>boolean} [opts.onUserMove]
   * @param {(sq:string)=>({type:'p'|'n'|'b'|'r'|'q'|'k', color:'w'|'b'}|null)} [opts.getPieceAt]
   * @param {(from:string)=>string[]} [opts.getLegalTargets]
   */
  constructor({ boardEl, arrowSvg=null, promoEl=null, onUserMove=null, getPieceAt=null, getLegalTargets=null }){
    this.boardEl = boardEl;
    this.arrowSvg = arrowSvg || boardEl.querySelector('#arrowSvg') || null;
    this.promoEl = promoEl;
    this.onUserMove = onUserMove || (()=>true);
    this.getPieceAt = getPieceAt || (()=>null);
    this.getLegalTargets = getLegalTargets || (()=>[]);
    this.orientation = 'white';
    this.fen = 'startpos';

    // drag/click state
    this.selected = null;
    this.dragTargets = new Set();
    this.dragStart = null;
    this.dragStarted = false;
    this.justDragged = false;
    this.dragGhost = null;
    this.hoverSq = null;

    // highlights
    this._lastFrom = null;
    this._lastTo = null;

    // position cache for diffs/check
    this._pos = {};
    this._turn = 'w';

    this._rafHandle = 0;
    this._pendingEvt = null;

    this.gSys = null; // overlay system group (if present)

    this.ensureSquares();
    this.ensureOverlayGroups();
    this.updateMetrics();
    this.attachLeftDrag();
    this.attachClick();

    window.addEventListener('resize', ()=>{
      this.updateMetrics();
      this.resizeOverlayViewBox();
    });
    this.resizeOverlayViewBox();
  }

  // ---------- DOM creation ----------
  ensureSquares(){
    let overlay = null;
    if (this.arrowSvg && this.arrowSvg.parentElement === this.boardEl){
      overlay = this.arrowSvg;
    }
    const needBuild = this.boardEl.querySelectorAll('.sq').length !== 64;
    if (needBuild){
      this.boardEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let r=8; r>=1; r--){
        for (let f=0; f<8; f++){
          const sq = `${FILES[f]}${r}`;
          const el = document.createElement('div');
          el.className = `sq ${(f+r)%2===0 ? 'light' : 'dark'}`;
          el.dataset.square = sq;
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          frag.appendChild(el);
        }
      }
      this.boardEl.appendChild(frag);

      // ghost
      this.dragGhost = document.createElement('div');
      this.dragGhost.className = 'dragPiece';
      this.dragGhost.style.position = 'absolute';
      this.dragGhost.style.pointerEvents = 'none';
      this.dragGhost.style.transform = 'translate(-9999px,-9999px)';
      this.dragGhost.style.display = 'none';
      this.boardEl.appendChild(this.dragGhost);
    } else {
      this.dragGhost = this.boardEl.querySelector('.dragPiece') || null;
    }

    if (overlay){
      this.boardEl.appendChild(overlay);
      this.arrowSvg = overlay;
    }

    const cs = getComputedStyle(this.boardEl);
    if (!cs.display || cs.display === 'block'){
      this.boardEl.style.display = 'grid';
      this.boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
      this.boardEl.style.aspectRatio = '1 / 1';
      this.boardEl.style.userSelect = 'none';
      this.boardEl.style.position = cs.position === 'static' ? 'relative' : cs.position;
      this.boardEl.style.fontSize = 'calc(min(9vmin, 56px))';
    }
  }

  ensureOverlayGroups(){
    if (!this.arrowSvg) return;
    let gSys = this.arrowSvg.querySelector('g.sys-arrows');
    if (!gSys){
      gSys = document.createElementNS('http://www.w3.org/2000/svg','g');
      gSys.setAttribute('class','sys-arrows');
      this.arrowSvg.appendChild(gSys);
    }
    this.gSys = gSys;
  }

  resizeOverlayViewBox(){
    if (!this.arrowSvg) return;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.arrowSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  }

  updateMetrics(){
    const r = this.boardEl.getBoundingClientRect();
    this.size = Math.min(r.width || 0, r.height || 0);
    this.cell = (this.size || 0)/8 || 0;
    this.boardEl.style.setProperty('--cell', `${this.cell}px`);
  }

  // ---------- Board API ----------
  setFen(fen){
    this.fen = fen || 'startpos';
    const { pos, turn } = parseFenPieces(this.fen);
    // diff old vs new to infer last move
    const prev = this._pos || {};
    const next = pos;

    // commit position
    this._pos = next;
    this._turn = turn;

    this.renderPosition();

    this.applyLastMoveFromDiff(prev, next);
    this.applyCheckHighlight(next, turn);
  }

  setOrientation(side){
    this.orientation = (side === 'black') ? 'black' : 'white';
    this.renderPosition();
  }

  flip(){ this.setOrientation(this.orientation === 'white' ? 'black' : 'white'); }

  // ---------- Rendering ----------
  renderPosition(){
    const pos = this._pos;
    const squares = this.boardEl.querySelectorAll('.sq');
    let idx = 0;
    for (let rank=8; rank>=1; rank--){
      for (let file=0; file<8; file++, idx++){
        const sq = `${FILES[file]}${rank}`;
        const el = squares[idx];
        const piece = pos[sq];
        el.textContent = '';
        el.classList.remove('pw','pb','sel','cap','hover','dragSource','hl-from','hl-to','hl-check');
        el.removeAttribute('data-piece');
        const dot = el.querySelector?.('.dot'); if (dot) dot.remove();

        if (piece){
          el.textContent = GLYPH[piece.color][piece.type];
          el.style.fontSize = 'calc(var(--cell) * 0.82)';
          el.classList.add(piece.color==='w' ? 'pw' : 'pb');
          el.setAttribute('data-piece', `${piece.color}${piece.type}`);
        }
      }
    }
    this.resizeOverlayViewBox();
  }

  // ---------- Highlights ----------
  applyLastMoveFromDiff(prev, next){
    // Clear old
    if (this._lastFrom) this.squareEl(this._lastFrom)?.classList?.remove('hl-from');
    if (this._lastTo)   this.squareEl(this._lastTo)?.classList?.remove('hl-to');
    this._lastFrom = this._lastTo = null;

    // find removals & additions
    const removed = [];
    const added = [];
    for (let r=1;r<=8;r++){
      for (let f=0;f<8;f++){
        const sq = `${FILES[f]}${r}`;
        const a = prev[sq] || null;
        const b = next[sq] || null;
        if (!a && b) added.push({sq, p:b});
        if (a && !b) removed.push({sq, p:a});
        if (a && b && (a.color!==b.color || a.type!==b.type)){
          removed.push({sq, p:a});
          added.push({sq, p:b});
        }
      }
    }
    if (added.length===0 && removed.length===0) return;

    // heuristic: prefer king move if present (castling)
    let fromSq = removed[0]?.sq || null;
    let toSq   = added[0]?.sq || null;
    const kingAdd = added.find(x=>x.p.type==='k');
    const kingRem = removed.find(x=>x.p.type==='k');
    if (kingAdd && kingRem){ fromSq = kingRem.sq; toSq = kingAdd.sq; }

    if (fromSq) { this.squareEl(fromSq)?.classList?.add('hl-from'); this._lastFrom = fromSq; }
    if (toSq)   { this.squareEl(toSq)?.classList?.add('hl-to');    this._lastTo   = toSq; }
  }

  applyCheckHighlight(pos, turn){
    // Clear any prior check
    for (let r=1;r<=8;r++){
      for (let f=0;f<8;f++){
        this.squareEl(`${FILES[f]}${r}`)?.classList?.remove('hl-check');
      }
    }
    // Only side-to-move can be in check
    const kingSq = findKingSquare(pos, turn);
    if (!kingSq) return;
    const attacker = (turn==='w') ? 'b' : 'w';
    const inCheck = isSquareAttacked(pos, kingSq, attacker);
    if (inCheck){
      this.squareEl(kingSq)?.classList?.add('hl-check');
    }
  }

  // ---------- Drag & click ----------
  attachLeftDrag(){
    if (!window.PointerEvent){ return; }
    const onDown = (e)=>{
      if (e.button !== 0 || (e.ctrlKey && !e.metaKey)) return;
      const sqEl = e.target.closest('.sq');
      if (!sqEl) return;
      const from = sqEl.dataset.square;
      const piece = this.getPieceAt(from);
      if (!piece) return;

      e.preventDefault();
      try{ this.boardEl.setPointerCapture(e.pointerId); }catch{}

      this.dragStart = { x0: e.clientX, y0: e.clientY, from, glyph: GLYPH[piece.color][piece.type], color: piece.color };
      this.dragStarted = false;
      this.justDragged = false;
      this.dragTargets = new Set(this.getLegalTargets(from) || []);
      this.selected = from;
      this.clearSelectionDots();
      this.markSelected(from, this.dragTargets);

      sqEl.classList.add('dragSource');

      const move = (ev)=>this.onPointerMove(ev);
      const up = (ev)=>{
        this.boardEl.removeEventListener('pointermove', move);
        this.boardEl.removeEventListener('pointerup', up);
        this.onPointerUp(ev);
      };
      this.boardEl.addEventListener('pointermove', move);
      this.boardEl.addEventListener('pointerup', up);
    };
    this.boardEl.addEventListener('pointerdown', onDown);
  }

  onPointerMove(e){
    if (!this.dragStart) return;
    if (!this.dragStarted){
      const dx = e.clientX - this.dragStart.x0;
      const dy = e.clientY - this.dragStart.y0;
      if ((dx*dx + dy*dy) < 9) return;
      this.dragStarted = true;
      this.justDragged = true;
      if (this.dragGhost){
        this.dragGhost.textContent = this.dragStart.glyph;
        this.dragGhost.style.display = 'flex';
        this.dragGhost.style.fontSize = 'calc(var(--cell) * 0.82)';
      }
    }
    this._pendingEvt = e;
    if (this._rafHandle) return;
    this._rafHandle = requestAnimationFrame(()=>{
      const ev = this._pendingEvt;
      this._pendingEvt = null;
      this._rafHandle = 0;
      if (!ev) return;
      const { left, top } = this.boardEl.getBoundingClientRect();
      const x = ev.clientX - left, y = ev.clientY - top;
      if (this.dragGhost){
        this.dragGhost.style.transform = `translate(${x - this.cell/2}px, ${y - this.cell/2}px)`;
      }
      const sq = this.squareFromXY(x, y);
      if (this.hoverSq && this.hoverSq !== sq) this.squareEl(this.hoverSq)?.classList?.remove('hover');
      this.hoverSq = sq;
      this.squareEl(sq)?.classList?.add('hover');
    });
  }

  onPointerUp(e){
    try{ this.boardEl.releasePointerCapture(e.pointerId); }catch{}
    if (this._rafHandle){ cancelAnimationFrame(this._rafHandle); this._rafHandle = 0; }
    if (this.dragGhost){
      this.dragGhost.style.display = 'none';
      this.dragGhost.style.transform = 'translate(-9999px,-9999px)';
    }
    if (this.hoverSq){
      this.squareEl(this.hoverSq)?.classList?.remove('hover');
      this.hoverSq = null;
    }
    const from = this.dragStart?.from;
    const started = this.dragStarted;
    this.dragStart = null;
    this.dragStarted = false;

    if (!started){ return; } // click handled in attachClick

    const { left, top } = this.boardEl.getBoundingClientRect();
    const x = e.clientX - left, y = e.clientY - top;
    const to = this.squareFromXY(x, y);
    if (!from || !to || from===to || !this.dragTargets.has(to)) return;

    // Delegate to app; assume synchronous accept for simplicity
    const ok = this.onUserMove({ from, to });
    if (ok){
      this.clearSelectionDots();
      this.selected = null;
    }
  }

  attachClick(){
    // Click-to-move (tap/tap). Toggle selection and show legal targets.
    this.boardEl.addEventListener('click', (e)=>{
      const sqEl = e.target.closest('.sq'); if (!sqEl) return;
      const sq = sqEl.dataset.square;
      const piece = this.getPieceAt(sq);

      // If a selection exists and clicked a legal target -> make move
      if (this.selected && this.dragTargets.has(sq)){
        const ok = this.onUserMove({ from: this.selected, to: sq });
        if (ok){
          this.clearSelectionDots();
          this.squareEl(this.selected)?.classList?.remove('sel');
          this.selected = null;
        }
        return;
      }

      // Otherwise (no selection or clicked own piece) -> (re)select
      if (piece){
        if (this.selected) this.squareEl(this.selected)?.classList?.remove('sel');
        this.selected = sq;
        this.dragTargets = new Set(this.getLegalTargets(sq) || []);
        this.clearSelectionDots();
        this.markSelected(sq, this.dragTargets);
      } else {
        // clicked empty square -> clear selection
        if (this.selected) this.squareEl(this.selected)?.classList?.remove('sel');
        this.clearSelectionDots();
        this.selected = null;
      }
    });
  }

  markSelected(from, targets){
    const el = this.squareEl(from);
    el?.classList?.add('sel');
    // dots
    targets.forEach(t=>{
      const tEl = this.squareEl(t);
      if (!tEl) return;
      const cap = (tEl.classList.contains('pw') || tEl.classList.contains('pb'));
      const dot = document.createElement('div');
      dot.className = 'dot' + (cap ? ' cap' : '');
      tEl.appendChild(dot);
    });
  }

  clearSelectionDots(){
    this.boardEl.querySelectorAll('.sq.sel').forEach(el=>el.classList.remove('sel'));
    this.boardEl.querySelectorAll('.sq .dot').forEach(el=>el.remove());
  }

  // ---------- Utils ----------
  squareEl(sq){ return this.boardEl.querySelector(`.sq[data-square="${sq}"]`); }

  squareFromXY(x, y){
    const size = Math.min(this.boardEl.clientWidth, this.boardEl.clientHeight);
    const cell = size/8;
    let f = Math.floor(x / cell);
    let r = 7 - Math.floor(y / cell); // y down -> rank up
    if (this.orientation === 'black'){
      f = 7 - f; r = 7 - r;
    }
    f = Math.max(0, Math.min(7, f));
    r = Math.max(0, Math.min(7, r));
    return `${FILES[f]}${r+1}`;
  }
}
