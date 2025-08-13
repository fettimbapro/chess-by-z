
// public/src/ui/BoardUI.js
// Restored BoardUI: renders 8x8 board, pieces from FEN, click/drag-to-move with promotion hooks.
// Integrates with an existing <svg id="arrowSvg"> overlay if present (DrawOverlay.js compatible).

const FILES = ['a','b','c','d','e','f','g','h'];
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBPPPP/RNBQKBNR'.replace('NBPP','NBPP'); // fallback

// Simple unicode glyphs; your CSS can override with images if preferred.
const GLYPH = {
  w: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export class BoardUI {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.boardEl  - container for 64 square nodes
   * @param {SVGElement}  [opts.arrowSvg] - optional overlay SVG; will be reused if present
   * @param {HTMLElement} [opts.promoEl]  - promotion picker (buttons with data-role=q|r|b|n)
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

    // drag state
    this.selected = null;
    this.dragTargets = new Set();
    this.dragStart = null;
    this.dragStarted = false;
    this.justDragged = false;
    this.dragGhost = null;
    this.hoverSq = null;
    this._rafHandle = 0;
    this._pendingEvt = null;

    // overlay groups for system arrows (if overlay exists)
    this.gSys = null;

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
    // Preserve overlay if it's inside board
    let overlay = null;
    if (this.arrowSvg && this.arrowSvg.parentElement === this.boardEl){
      overlay = this.arrowSvg;
    }

    // Rebuild squares if not present
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

    // Re-attach overlay last so it sits above squares
    if (overlay){
      this.boardEl.appendChild(overlay);
      this.arrowSvg = overlay;
    }

    // Grid sizing (fallback if CSS not present)
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
    // Use existing <g class="sys-arrows"> or create it
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
    this.renderPosition();
  }

  setOrientation(side){
    this.orientation = (side === 'black') ? 'black' : 'white';
    this.renderPosition();
  }

  flip(){
    this.setOrientation(this.orientation === 'white' ? 'black' : 'white');
  }

  // ---------- Rendering ----------
  renderPosition(){
    const pos = parseFenPieces(this.fen);
    const squares = this.boardEl.querySelectorAll('.sq');
    let idx = 0;

    for (let rank=8; rank>=1; rank--){
      for (let file=0; file<8; file++, idx++){
        const sq = `${FILES[file]}${rank}`;
        const el = squares[idx];
        const piece = pos[sq];
        el.textContent = '';
        el.classList.remove('pw','pb','sel','cap','hover','dragSource');
        if (piece){
          el.textContent = GLYPH[piece.color][piece.type];
          el.style.fontSize = 'calc(var(--cell) * 0.82)';
          el.classList.add(piece.color==='w' ? 'pw' : 'pb');
        }
        const dot = el.querySelector?.('.dot');
        if (dot) dot.remove();
      }
    }
    // Update overlay sizing
    this.resizeOverlayViewBox();
  }

  // ---------- Drag & click ----------
  attachLeftDrag(){
    if (!window.PointerEvent){
      // fallback: no drag on very old browsers
      return;
    }
    const onDown = (e)=>{
      if (e.button !== 0 || (e.ctrlKey && !e.metaKey)) return;
      const sqEl = e.target.closest('.sq'); if (!sqEl) return;
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
      const ev = this._pendingEvt; this._pendingEvt = null; this._rafHandle = 0;
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
    if (this.hoverSq){ this.squareEl(this.hoverSq)?.classList?.remove('hover'); this.hoverSq = null; }
    const from = this.dragStart?.from;
    const started = this.dragStarted;
    this.dragStart = null;
    this.dragStarted = false;

    if (!started){
      // a click; click handler will deal with it
      return;
    }
    const { left, top } = this.boardEl.getBoundingClientRect();
    const x = e.clientX - left, y = e.clientY - top;
    const to = this.squareFromXY(x, y);
    if (!from || !to || from===to || !this.dragTargets.has(to)) return;

    // Promotion handling is delegated to App via onUserMove; we just pass promotion if App asks.
    const ok = this.onUserMove({ from, to });
    if (!ok){
      const el = this.squareEl(to); if (el){ el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'), 180); }
    }
    this.selected = null;
    this.dragTargets.clear();
  }

  attachClick(){
    this.boardEl.addEventListener('click', (e)=>{
      if (this.justDragged){ this.justDragged = false; return; }
      const sqEl = e.target.closest('.sq'); if (!sqEl) return;
      const sq = sqEl.dataset.square;
      if (this.selected && this.dragTargets.has(sq)){
        const ok = this.onUserMove({ from: this.selected, to: sq });
        if (!ok){
          sqEl.classList.add('shake'); setTimeout(()=>sqEl.classList.remove('shake'), 180);
        }
        this.selected = null; this.dragTargets.clear();
        return;
      }
      const piece = this.getPieceAt(sq);
      if (piece){
        this.selected = sq;
        this.dragTargets = new Set(this.getLegalTargets(sq) || []);
      } else {
        this.selected = null; this.dragTargets.clear();
      }
    });
  }

  // ---------- Helpers ----------
  squareFromXY(x, y){
    const orientWhite = (this.orientation === 'white');
    const file = Math.max(0, Math.min(7, Math.floor(x / this.cell)));
    const rank = Math.max(0, Math.min(7, Math.floor(y / this.cell)));
    const xf = orientWhite ? file : 7 - file;
    const yr = orientWhite ? 7 - rank : rank;
    return `${FILES[xf]}${yr+1}`;
  }
  squareEl(sq){ return this.boardEl.querySelector(`.sq[data-square="${sq}"]`); }

  // ---------- System arrows (optional, uses arrowSvg if present) ----------
  clearArrow(){
    if (this.gSys) this.gSys.innerHTML = '';
  }
  drawArrowUci(uci, primary=true){
    if (!this.arrowSvg) return;
    if (!this.gSys) this.ensureOverlayGroups();
    if (!this.gSys) return;
    const from = uci.slice(0,2), to = uci.slice(2,4);
    const color = primary ? '#6ba7ff' : 'rgba(107,167,255,.6)';
    const sw = primary ? 10 : 6;
    drawArrowOnLayer(this.gSys, from, to, color, sw, this.cell, this.orientation);
  }

  // celebration stubs to keep App calls safe
  celebrate() {}
  stopCelebration() {}
}

// --------- Shared overlay arrow helper (no user drawings here) ----------
function drawArrowOnLayer(layer, fromSq, toSq, color, sw, cell, orientation){
  const a = squareCenter(fromSq, cell, orientation);
  const b = squareCenter(toSq, cell, orientation);
  const ux = (b.x - a.x), uy = (b.y - a.y);
  const len = Math.hypot(ux,uy) || 1;
  const nx = ux/len, ny = uy/len;
  const head = Math.min(18, Math.max(12, cell*0.22));
  const w = Math.min(9, Math.max(6, cell*0.11));

  const line = document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', sw);
  line.setAttribute('stroke-linecap', 'round');

  const tri = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  const hx = b.x - nx*head, hy = b.y - ny*head, npx=-ny, npy=nx;
  tri.setAttribute('points', `${b.x},${b.y} ${hx+npx*w},${hy+npy*w} ${hx-npx*w},${hy-npy*w}`);
  tri.setAttribute('fill', color);

  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.appendChild(line); g.appendChild(tri);
  layer.appendChild(g);
}

function squareCenter(square, cell, orientation){
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1],10) - 1;
  const orientWhite = (orientation === 'white');
  const x = orientWhite ? file : (7 - file);
  const y = orientWhite ? (7 - rank) : rank;
  return {x:(x + 0.5) * cell, y:(y + 0.5) * cell};
}

// --------- FEN parsing ----------
function parseFenPieces(fen){
  if (!fen || fen === 'startpos' || fen === 'start') fen = START_FEN;
  const pieceField = String(fen).split(' ')[0];
  const out = Object.create(null);
  let rank = 8, file = 0;
  for (let i=0;i<pieceField.length;i++){
    const ch = pieceField[i];
    if (ch === '/'){ rank--; file = 0; continue; }
    if (ch >= '1' && ch <= '8'){ file += (ch.charCodeAt(0)-48); continue; }
    const sq = `${FILES[file]}${rank}`;
    const color = (ch === ch.toUpperCase()) ? 'w' : 'b';
    const type = ch.toLowerCase();
    out[sq] = { color, type };
    file++;
  }
  return out;
}

export default BoardUI;
