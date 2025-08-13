// BoardUI.js

// Unicode glyphs: use only BLACK shapes; we color them via CSS classes
const GLYPH = {
  w:{ k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' },
  b:{ k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' }
};
const FILES = ['a','b','c','d','e','f','g','h'];

export class BoardUI {
  constructor({ boardEl, arrowSvg, promoEl, evalbar, onUserMove, getPieceAt, getLegalTargets }){
    this.boardEl = boardEl;
    this.arrowSvg = arrowSvg;
    this.promoEl = promoEl;
    this.evalbar = evalbar;
    this.onUserMove = onUserMove;
    this.getPieceAt = getPieceAt;
    this.getLegalTargets = getLegalTargets;

    this.orientation = 'white';
    this.fen = 'startpos';

    // drag / click state (move pieces)
    this.selected = null;
    this.originEl = null;
    this.dragTargets = new Set();
    this.dragStart = null;       // {x0,y0,from,glyph,color}
    this.dragStarted = false;
    this.justDragged = false;
    this.dragGhost = null;
    this.hoverSq = null;
    this._rafHandle = 0; this._pendingXY = null;

    // user drawings (right-click)
    this.drawStart = null;       // {fromSq, x0, y0, modKey}
    this.userArrows = new Set(); // keys like 'e2e4:g/r/y/b'
    this.userCircles = new Set(); // keys like 'e4:g/r/y/b'
    this.gUser = null; this.gSys = null; this.gPreview = null; this.gMarks = null;

    this.ensureSquares();
    this.ensureArrowLayers();
    this.attachLeftDragToMove();
    this.attachClickToMove();
    this.attachRightDragToDraw();

    // Disable context menu so right-drag works nicely
    this.boardEl.addEventListener('contextmenu', (e)=> e.preventDefault());

    window.addEventListener('resize', () => { this.updateMetrics(); this.resizeOverlay(); this.redrawUserDrawings?.(); });
    this.updateMetrics();
    this.resizeOverlay();
  }

  // --- Static grid ---
  ensureSquares(){
    if (this.boardEl.childElementCount >= 64) return;
    this.boardEl.innerHTML = '';
    for (let r=8;r>=1;r--){
      for (let f=0; f<8; f++){
        const sq = `${FILES[f]}${r}`;
        const el = document.createElement('div');
        el.className = `sq ${(f+r)%2===0 ? 'light' : 'dark'} piece`;
        el.dataset.square = sq;
        this.boardEl.appendChild(el);
      }
    }
    // drag ghost
    this.dragGhost = document.createElement('div');
    this.dragGhost.className = 'dragPiece';
    this.dragGhost.style.display = 'none';
    this.dragGhost.style.transform = 'translate(-9999px,-9999px)';
    this.boardEl.appendChild(this.dragGhost);
  }


  // === Drawing helpers (colors & circles) ===
  colorFromMods(e){
    if (e.shiftKey) return 'r';
    if (e.altKey)   return 'y';
    if (e.ctrlKey || e.metaKey) return 'b';
    return 'g';
  }
  colorToCss(key){
    return ({ g:'#39d98a', r:'#ff5d5d', y:'#ffd166', b:'#69a7ff' })[key] || '#39d98a';
  }
  drawCircleOnLayer(layer, sq, color, sw, dataKey=null){
    const c = this.squareCenter(sq);
    const r = this.cell * 0.36;
    const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
    ring.setAttribute('cx', c.x);
    ring.setAttribute('cy', c.y);
    ring.setAttribute('r', r);
    ring.setAttribute('stroke', color);
    ring.setAttribute('stroke-width', Math.max(6, Math.floor(sw*0.85)));
    ring.setAttribute('fill', 'none');
    if (dataKey) ring.setAttribute('data-circle', dataKey);
    layer.appendChild(ring);
  }

  ensureArrowLayers(){
    if (!this.arrowSvg) return;
    // three layers: user (green), system (engine/hint), preview (while dragging)
    this.arrowSvg.innerHTML = '';
    this.gUser = document.createElementNS('http://www.w3.org/2000/svg','g');
    this.gUser.setAttribute('class','user-arrows');
    this.gSys = document.createElementNS('http://www.w3.org/2000/svg','g');
    this.gSys.setAttribute('class','sys-arrows');
    this.gPreview = document.createElementNS('http://www.w3.org/2000/svg','g');
    this.gPreview.setAttribute('class','preview-arrow');
    this.gMarks = document.createElementNS('http://www.w3.org/2000/svg','g');
    this.gMarks.setAttribute('class','user-marks');
    this.arrowSvg.appendChild(this.gUser);
    this.arrowSvg.appendChild(this.gSys);
    this.arrowSvg.appendChild(this.gPreview);
    this.arrowSvg.appendChild(this.gMarks);
  }

  // ===== LEFT BUTTON: drag-to-move =====
  attachLeftDragToMove(){
    const down = (ev) => {
      // ONLY left button
      const isLeft = ev.button === 0 && !(ev.ctrlKey && !ev.metaKey); // mac ctrl+click shouldn't start left drag
      if (!isLeft) return;

      const sqEl = ev.target.closest('.sq'); if (!sqEl) return;
      const from = sqEl.dataset.square;
      const piece = this.getPieceAt?.(from); if (!piece) return;

      ev.preventDefault();
      try{ this.boardEl.setPointerCapture(ev.pointerId); }catch{}
      this.boardEl.classList.add('dragging');

      // selection + legal targets (also used by click-to-move)
      this.dragTargets = new Set(this.getLegalTargets?.(from) || []);
      this.selected = from; this.renderHighlights();
      this.originEl = sqEl; this.originEl.classList.add('dragSource');

      const glyph = GLYPH[piece.color][piece.type];
      this.dragStart = { x0: ev.clientX, y0: ev.clientY, from, glyph, color: piece.color };
      this.dragStarted = false;
      this.justDragged = false;

      const move = (e) => this.onPointerMove(e);
      const up   = (e) => {
        this.boardEl.removeEventListener('pointermove', move);
        this.boardEl.removeEventListener('pointerup', up);
        this.onPointerUp(e);
      };
      this.boardEl.addEventListener('pointermove', move);
      this.boardEl.addEventListener('pointerup', up);
    };
    this.boardEl.addEventListener('pointerdown', down);
  }

  onPointerMove(e){
    if (!this.dragStart) return;

    // Start drag only if moved enough (avoid flicker for click)
    if (!this.dragStarted){
      const dx = e.clientX - this.dragStart.x0;
      const dy = e.clientY - this.dragStart.y0;
      if ((dx*dx + dy*dy) < 9) return; // 3px threshold
      this.dragStarted = true;
      this.justDragged = true;

      // show ghost now
      this.dragGhost.textContent = this.dragStart.glyph;
      this.dragGhost.className = `dragPiece ${this.dragStart.color==='w'?'pw':'pb'}`;
      this.dragGhost.style.display = 'flex';
    }

    this.queueGhostToEvent(e);
  }

  async onPointerUp(e){
    try { this.boardEl.releasePointerCapture(e.pointerId); } catch {}
    this.boardEl.classList.remove('dragging');

    if (this._rafHandle){ cancelAnimationFrame(this._rafHandle); this._rafHandle=0; }
    if (this.hoverSq) { this.squareEl(this.hoverSq)?.classList.remove('hover'); this.hoverSq = null; }
    if (this.originEl) this.originEl.classList.remove('dragSource');

    // If we never started dragging, do nothing here — click handler will take over
    if (!this.dragStarted){
      this.hideGhost();
      this.dragStart = null;
      return;
    }

    // We did drag: process drop
    const from = this.dragStart?.from;
    this.dragStart = null;

    const { left, top } = this.boardEl.getBoundingClientRect();
    const x = e.clientX - left, y = e.clientY - top;
    const to = this.squareFromCoords(x, y);

    const finalize = () => {
      this.hideGhost();
      this.clearSelection(); // classic UX after a real drag
    };

    if (!to || !from || from===to || !this.dragTargets.has(to)){ finalize(); return; }

    // Promotion flow
    if (this.needsPromotion(from, to)){
      const choice = await this.pickPromotion();
      if (!choice){ finalize(); return; }
      const ok = this.onUserMove({ from, to, promotion: choice });
      if (!ok) this.bumpSquare(to);
      finalize(); return;
    }

    const ok = this.onUserMove({ from, to });
    if (!ok) this.bumpSquare(to);
    finalize();
  }

  // ===== CLICK-TO-MOVE =====
  attachClickToMove(){
    this.boardEl.addEventListener('click', async (e) => {
      if (this.justDragged){ this.justDragged = false; return; } // ignore synthetic click after drag
      const sqEl = e.target.closest('.sq'); if (!sqEl) return;
      const sq = sqEl.dataset.square;

      if (this.selected && this.dragTargets.has(sq)){
        const from = this.selected, to = sq;
        if (this.needsPromotion(from, to)){
          const choice = await this.pickPromotion();
          if (!choice){ this.clearSelection(); return; }
          const ok = this.onUserMove({ from, to, promotion: choice });
          if (!ok) this.bumpSquare(to);
        } else {
          const ok = this.onUserMove({ from, to });
          if (!ok) this.bumpSquare(to);
        }
        this.clearSelection();
        return;
      }

      const piece = this.getPieceAt?.(sq);
      if (piece){
        this.selected = sq;
        this.dragTargets = new Set(this.getLegalTargets?.(sq) || []);
        this.renderHighlights();
      } else {
        this.clearSelection();
      }
    });
  }

  clearSelection(){
    this.selected = null;
    this.dragTargets.clear();
    this.renderHighlights();
  }

  bumpSquare(sq){
    const el = this.squareEl(sq);
    if (!el) return;
    el.classList.add('shake'); setTimeout(()=> el.classList.remove('shake'), 180);
  }

  // ===== RIGHT BUTTON: drag-to-draw arrows =====

  // ===== RIGHT BUTTON: drag-to-draw arrows & short-click circles =====
  attachRightDragToDraw(){
    const onMouseDown = (e) => {
      const isRight = (e.button === 2) || (e.buttons & 2) || (!!e.ctrlKey && e.button === 0);
      if (!isRight) return;
      const fromSq = this._coordsToSquare(e);
      if (!fromSq) return;

      e.preventDefault();
      const modKey = this.colorFromMods(e);
      this.drawStart = { fromSq, x0: e.clientX, y0: e.clientY, modKey };
      this.renderPreview(fromSq, fromSq);

      const move = (ev) => {
        if (!this.drawStart) return;
        const toSq = this._coordsToSquare(ev) || this.drawStart.fromSq;
        this.renderPreview(this.drawStart.fromSq, toSq);
      };
      const up = (ev) => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.finishRightDrag(ev);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };

    if (window.PointerEvent){
      this.boardEl.addEventListener('pointerdown', (e)=>{
        const rightish = (e.button===2) || (e.buttons & 2) || (!!e.ctrlKey && e.button===0);
        if (!rightish) return;
        e.preventDefault();
        onMouseDown(e);
      });
    } else {
      this.boardEl.addEventListener('mousedown', onMouseDown);
    }
  }

  finishRightDrag(e){
    const start = this.drawStart; this.drawStart = null;
    if (this.gPreview) this.gPreview.innerHTML = '';
    if (!start) return;

    const toSq = this._coordsToSquare(e) || start.fromSq;
    const dx = e.clientX - start.x0, dy = e.clientY - start.y0;
    const movedEnough = (dx*dx + dy*dy) > 16; // ~4px

    const colorKey = start.modKey || 'g';
    const color = this.colorToCss(colorKey);
    const sw = Math.max(8, Math.floor(this.cell*0.14));

    // Short click/tiny drag -> toggle circle on source
    if (!movedEnough || toSq === start.fromSq){
      const key = `${start.fromSq}:${colorKey}`;
      if (this.userCircles.has(key)){
        this.userCircles.delete(key);
        this.gMarks?.querySelector(`[data-circle="${key}"]`)?.remove();
      } else {
        this.userCircles.add(key);
        if (!this.gMarks) this.ensureArrowLayers();
        this.drawCircleOnLayer(this.gMarks, start.fromSq, color, sw, key);
      }
      return;
    }

    // Real drag -> toggle arrow
    const uci = start.fromSq + toSq;
    const akey = `${uci}:${colorKey}`;
    if (this.userArrows.has(akey)){
      this.userArrows.delete(akey);
      const node = this.gUser?.querySelector(`[data-uci="${akey}"]`);
      node && node.remove();
    } else {
      this.userArrows.add(akey);
      if (!this.gUser) this.ensureArrowLayers();
      this.drawArrowOnLayer(this.gUser, start.fromSq, toSq, color, sw, akey);
    }
  }

  

  _coordsToSquare(ev){
    const { left, top } = this.boardEl.getBoundingClientRect();
    const x = ev.clientX - left, y = ev.clientY - top;
    return this.squareFromCoords(x, y);
    }

  renderPreview(fromSq, toSq){
    if (!this.gPreview) return;
    this.gPreview.innerHTML = '';
    if (!fromSq || !toSq) return;
    // faint preview
    this.drawArrowOnLayer(this.gPreview, fromSq, toSq, 'rgba(107,167,255,.5)', Math.max(7, Math.floor(this.cell*0.12)));
  }

  clearUserArrows(){
    this.userArrows.clear();
    if (this.gUser) this.gUser.innerHTML = '';
  }

  redrawUserArrows(){
    if (!this.gUser) return;
    this.gUser.innerHTML = '';
    for (const key of this.userArrows){
      const [uci, colorKey='g'] = key.split(':');
      const from = uci.slice(0,2), to = uci.slice(2,4);
      this.drawArrowOnLayer(this.gUser, from, to, this.colorToCss(colorKey), Math.max(8, Math.floor(this.cell*0.14)), key);
    }
  }


  clearUserCircles(){
    this.userCircles.clear();
    if (this.gMarks) this.gMarks.innerHTML = '';
  }

  redrawUserCircles(){
    if (!this.gMarks) return;
    this.gMarks.innerHTML = '';
    for (const key of this.userCircles){
      const [sq, colorKey='g'] = key.split(':');
      this.drawCircleOnLayer(this.gMarks, sq, this.colorToCss(colorKey), Math.max(8, Math.floor(this.cell*0.14)), key);
    }
  }

  redrawUserDrawings(){
    this.redrawUserArrows();
    this.redrawUserCircles();
  }

  getUserDrawings(){
    return {
      arrows: Array.from(this.userArrows).map(k=>{ const [uci,color='g']=k.split(':'); return { uci, color }; }),
      circles: Array.from(this.userCircles).map(k=>{ const [sq,color='g']=k.split(':'); return { sq, color }; })
    };
  }

  setUserDrawings({ arrows=[], circles=[] } = {}){
    this.clearUserArrows();
    this.clearUserCircles();
    for (const a of arrows){
      const ck = (a.color||'g');
      const key = `${a.uci}:${ck}`;
      this.userArrows.add(key);
    }
    for (const c of circles){
      const ck = (c.color||'g');
      const key = `${c.sq}:${ck}`;
      this.userCircles.add(key);
    }
    this.redrawUserDrawings();
  }
// ===== Public API =====
  setFen(fen){ this.fen = fen; this.renderPosition(); }
  setOrientation(side){
    this.orientation = (side==='black') ? 'black':'white';
    this.renderPosition();
    this.redrawUserDrawings?.(); // keep user drawings aligned after flip
  }
  flip(){ this.orientation = (this.orientation==='white') ? 'black' : 'white'; this.setOrientation(this.orientation); }

  // ===== Rendering pieces / highlights =====
  renderPosition(){
    const pos = parseFenPieces(this.fen);
    const nodes = this.boardEl.children; // includes ghost as last child
    let idx = 0;
    for (let rank=8; rank>=1; rank--){
      for (let file=0; file<8; file++, idx++){
        const sq = `${FILES[file]}${rank}`;
        const el = nodes[idx];
        const piece = pos[sq];
        el.textContent = piece ? GLYPH[piece.color][piece.type] : '';
        el.classList.remove('pw','pb','dragSource','hover','sel','cap');
        if (piece) el.classList.add(piece.color==='w' ? 'pw' : 'pb');
        const dot = el.querySelector('.dot'); if (dot) dot.remove();
      }
    }
    this.renderHighlights();
    this.resizeOverlay();
  }

  renderHighlights(){
    for (const el of this.boardEl.querySelectorAll('.sq')){
      el.classList.remove('sel','cap');
      const dot = el.querySelector('.dot'); if (dot) dot.remove();
    }
    if (!this.selected) return;
    const src = this.squareEl(this.selected);
    if (src) src.classList.add('sel');
    for (const sq of this.dragTargets){
      const el = this.squareEl(sq);
      if (!el) continue;
      if (el.textContent) el.classList.add('cap');
      else { const d = document.createElement('div'); d.className='dot'; el.appendChild(d); }
    }
  }

  updateMetrics(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width, r.height);
    this.size = size;
    this.cell = size / 8;
    this.boardEl.style.setProperty('--cell', `${this.cell}px`);
    this.boardEl.style.setProperty('--pieceSize', `${Math.floor(this.cell*0.82)}px`);
  }
  squareEl(sq){ return this.boardEl.querySelector(`.sq[data-square="${sq}"]`); }
  squareFromCoords(x, y){
    const orientWhite = (this.orientation === 'white');
    const file = Math.max(0, Math.min(7, Math.floor(x / this.cell)));
    const rank = Math.max(0, Math.min(7, Math.floor(y / this.cell)));
    const xf = orientWhite ? file : 7 - file;
    const yr = orientWhite ? 7 - rank : rank;
    return `${FILES[xf]}${yr+1}`;
  }
  squareCenter(square){
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1],10) - 1;
    const orientWhite = (this.orientation === 'white');
    const x = orientWhite ? file : (7 - file);
    const y = orientWhite ? (7 - rank) : rank;
    return {x:(x + 0.5) * this.cell, y:(y + 0.5) * this.cell};
  }

  // Drag ghost helpers
  setGhostImmediate(x, y){
    this.dragGhost.style.display = 'flex';
    this.dragGhost.style.transform = `translate(${x - this.cell/2}px, ${y - this.cell/2}px)`;
  }
  hideGhost(){
    this.dragGhost.style.display = 'none';
    this.dragGhost.style.transform = 'translate(-9999px,-9999px)';
  }
  queueGhostToEvent(e){
    if (!this.dragStarted) return;
    this._pendingXY = e;
    if (this._rafHandle) return;
    this._rafHandle = requestAnimationFrame(()=>{
      const ev = this._pendingXY; this._pendingXY = null; this._rafHandle=0;
      if (!ev) return;
      const { left, top } = this.boardEl.getBoundingClientRect();
      const x = ev.clientX - left, y = ev.clientY - top;
      this.setGhostImmediate(x, y);
      const sq = this.squareFromCoords(x, y);
      if (this.hoverSq && this.hoverSq !== sq) this.squareEl(this.hoverSq)?.classList.remove('hover');
      this.hoverSq = sq; this.squareEl(sq)?.classList.add('hover');
    });
  }

  // ===== ARROWS =====
  // System arrows (engine/hint): these should NOT clear user arrows
  clearArrow(){
    if (!this.gSys) this.ensureArrowLayers();
    this.gSys.innerHTML = '';
  }

  drawArrowUci(uci, primary=true){
    if (!uci) return;
    if (!this.gSys) this.ensureArrowLayers();
    const from = uci.slice(0,2), to = uci.slice(2,4);
    const color = primary ? '#6ba7ff' : 'rgba(107,167,255,.6)';
    const sw = primary ? 10 : 6;
    this.drawArrowOnLayer(this.gSys, from, to, color, sw);
  }

  drawArrowOnLayer(layer, fromSq, toSq, color, sw, dataUci=null){
    const a = this.squareCenter(fromSq);
    const b = this.squareCenter(toSq);
    const ux = (b.x - a.x), uy = (b.y - a.y);
    const len = Math.hypot(ux,uy) || 1;
    const nx = ux/len, ny = uy/len;
    const head = Math.min(18, Math.max(12, this.cell*0.22));
    const w = Math.min(9, Math.max(6, this.cell*0.11));

    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
    line.setAttribute('stroke',color); line.setAttribute('stroke-width',sw); line.setAttribute('stroke-linecap','round');

    const tri = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    const hx = b.x - nx*head, hy = b.y - ny*head, npx=-ny, npy=nx;
    tri.setAttribute('points', `${b.x},${b.y} ${hx+npx*w},${hy+npy*w} ${hx-npx*w},${hy-npy*w}`);
    tri.setAttribute('fill',color);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    if (dataUci) g.setAttribute('data-uci', dataUci);
    g.appendChild(line); g.appendChild(tri);
    layer.appendChild(g);
  }

  // === Celebration FX ===
  resizeOverlay(){
    const r = this.boardEl.getBoundingClientRect();
    const size = r.width;
    this.arrowSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    const dpr = window.devicePixelRatio || 1;
    const cnv = document.getElementById('fireworks');
    if (!cnv) return;
    cnv.width = Math.floor(size*dpr);
    cnv.height = Math.floor(size*dpr);
    cnv.style.width = size+'px'; cnv.style.height = size+'px';
    cnv.style.position = 'absolute';
    cnv.style.zIndex = '999';
    if (!this.fxCtx) this.fxCtx = cnv.getContext('2d');
    if (this.fxCtx) this.fxCtx.setTransform(dpr,0,0,dpr,0,0);
  }

  celebrate(){
    if (this.hasCelebrated) return;
    this.hasCelebrated = true;
    this.startFireworks();
    setTimeout(()=>this.stopCelebration(), 3500);
  }
  stopCelebration(){
    this.stopFireworks();
    this.hasCelebrated = false;
  }

  startFireworks(){
    this.fxCanvas = document.getElementById('fireworks');
    if (!this.fxCanvas) return;
    if (!this.fxCtx) this.resizeOverlay();
    if (!this.fxCtx) this.fxCtx = this.fxCanvas.getContext('2d');
    this.fxCanvas.style.zIndex = '999';
    this.fxCanvas.style.display='block';

    this.fxParticles = [];
    this.fxSpawnTimer = performance.now() - 181;

    const loop = () => {
      this.fxRAF = requestAnimationFrame(loop);
      const now = performance.now();
      if (!this.fxCanvas || !this.fxCtx) return;

      if (now - this.fxSpawnTimer > 180){
        this.fxSpawnTimer = now;
        this.spawnBurst();
      }

      const ctx = this.fxCtx;
      ctx.clearRect(0,0,this.fxCanvas.width,this.fxCanvas.height);
      const g=0.15, fr=0.992;
      for (let i=this.fxParticles.length-1;i>=0;i--){
        const p = this.fxParticles[i];
        p.vx *= fr; p.vy = p.vy*fr + g;
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.016;
        ctx.globalCompositeOperation='lighter';
        ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,p.size),0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.r},${p.g},${p.b},${Math.max(0,p.life)})`; ctx.fill();
        ctx.globalCompositeOperation='source-over';
        if (p.life<=0 || p.y>this.fxCanvas.height+20) this.fxParticles.splice(i,1);
      }
    };
    this.fxRAF = requestAnimationFrame(loop);
  }

  stopFireworks(){
    if (this.fxRAF) cancelAnimationFrame(this.fxRAF);
    if (this.fxCanvas) this.fxCanvas.style.display='none';
    this.fxParticles = [];
  }

  spawnBurst(){
    const W = this.fxCanvas?.width || 512;
    const H = this.fxCanvas?.height || 512;
    const ox = (0.25 + 0.5*Math.random()) * W;
    const oy = (0.20 + 0.45*Math.random()) * H;
    const n = 36 + Math.floor(Math.random()*24);
    const hue = Math.floor(Math.random()*360);
    for (let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2 + (Math.random()*0.2);
      const speed=3+Math.random()*4;
      const vx=Math.cos(a)*speed, vy=Math.sin(a)*speed;
      const [r,g,b]=this.hsl(hue + Math.random()*40, 80, 60);
      this.fxParticles.push({x:ox,y:oy,vx,vy,r,g,b,size:1+Math.random()*2,life:0.9+Math.random()*0.5});
    }
  }

  hsl(h,s,l){
    h=(h%360)/360; s/=100; l/=100;
    const a = s*Math.min(l,1-l);
    const f = (n)=> {
      const k=(n+h)%1;
      return l - a*Math.max(-1, Math.min(k*6-3, Math.min(4-k*6, 1)));
    };
    return [Math.round(255*f(0)), Math.round(255*f(1/3)), Math.round(255*f(2/3))];
  }
}

// Helpers
function parseFenPieces(fen){
  const p = {};
  const board = fen.split(' ')[0];
  let rank = 8, file = 1;
  for (const ch of board){
    if (ch === '/') { rank--; file=1; continue; }
    if (/\d/.test(ch)) { file += parseInt(ch,10); continue; }
    const color = (ch === ch.toLowerCase()) ? 'b' : 'w';
    const type = ch.toLowerCase();
    const sq = `${String.fromCharCode(96+file)}${rank}`;
    p[sq] = { color, type };
    file++;
  }
  return p;
}
