
// ui/BoardUI.js
// BoardUI with right-click drawing (arrows & circles) + safe overlay handling.
// This file is designed to be drop-in and *not* disturb your existing game logic.
// It exposes common methods used elsewhere (drawArrowUci, clearArrow, flip, etc.).

const FILES = ['a','b','c','d','e','f','g','h'];
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export class BoardUI {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.boardEl
   * @param {SVGElement}  opts.arrowSvg
   * @param {HTMLElement} [opts.promoEl]
   * @param {object}      [opts.evalbar]
   * @param {Function}    [opts.onUserMove]
   * @param {Function}    [opts.getPieceAt]
   * @param {Function}    [opts.getLegalTargets]
   */
  constructor({ boardEl, arrowSvg, promoEl=null, evalbar=null, onUserMove=null, getPieceAt=null, getLegalTargets=null }) {
    this.boardEl = boardEl;
    this.arrowSvg = arrowSvg;
    this.promoEl = promoEl;
    this.evalbar = evalbar;

    this.onUserMove = onUserMove;
    this.getPieceAt = getPieceAt;
    this.getLegalTargets = getLegalTargets;

    // board metrics & state
    this.orientation = 'white';
    this.size = 0;
    this.cell = 0;

    // drawing state
    this.drawStart = null;           // {fromSq, x0, y0, modKey}
    this.userArrows = new Set();     // keys: `${uci}:${colorKey}`
    this.userCircles = new Set();    // keys: `${sq}:${colorKey}`
    this.gUser = null;               // <g> for user arrows
    this.gSys = null;                // <g> for system arrows
    this.gPreview = null;            // <g> for preview arrow
    this.gMarks = null;              // <g> for circle marks

    // ensure SVG layers and metrics
    this.ensureArrowLayers();
    this.updateMetrics();
    this.resizeOverlay();

    // listeners
    this.attachRightDragToDraw();
    // Prevent native context menu over the board (capture phase is important for Safari)
    this.boardEl.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    window.addEventListener('resize', () => {
      this.updateMetrics();
      this.resizeOverlay();
      this.redrawUserDrawings();
    });
  }

  // ---------- Metrics & geometry ----------
  updateMetrics(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.size = size > 0 ? size : (this.boardEl.clientWidth || 0);
    this.cell = (this.size || 0) / 8 || 0;
  }

  squareFromCoords(x, y){
    if (!this.cell) return null;
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

  _coordsToSquare(ev){
    const r = this.boardEl.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    return this.squareFromCoords(x, y);
  }

  // ---------- SVG layers ----------
  ensureArrowLayers(){
    if (!this.arrowSvg) return;
    // Make sure we don't destroy existing nodes accidentally
    while (this.arrowSvg.firstChild) this.arrowSvg.removeChild(this.arrowSvg.firstChild);

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

  resizeOverlay(){
    if (!this.arrowSvg) return;
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.arrowSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    this.arrowSvg.style.width = `${size}px`;
    this.arrowSvg.style.height = `${size}px`;
  }

  // ---------- Public API commonly used elsewhere ----------
  setOrientation(side){
    this.orientation = (side === 'black') ? 'black' : 'white';
    this.redrawUserDrawings();
  }
  flip(){
    this.setOrientation(this.orientation === 'white' ? 'black' : 'white');
  }
  clearArrow(){
    if (this.gSys) this.gSys.innerHTML = '';
  }
  drawArrowUci(uci, primary=true){
    if (!uci || !this.gSys) return;
    const from = uci.slice(0,2);
    const to = uci.slice(2,4);
    const color = primary ? '#6ba7ff' : 'rgba(107,167,255,.6)';
    const sw = primary ? 10 : 6;
    this.drawArrowOnLayer(this.gSys, from, to, color, sw);
  }

  clearUserArrows(){ this.userArrows.clear(); if (this.gUser) this.gUser.innerHTML = ''; }
  clearUserCircles(){ this.userCircles.clear(); if (this.gMarks) this.gMarks.innerHTML = ''; }

  redrawUserArrows(){
    if (!this.gUser) return;
    this.gUser.innerHTML = '';
    const sw = Math.max(8, Math.floor(this.cell*0.14));
    for (const key of this.userArrows){
      const [uci, colorKey='g'] = key.split(':');
      const from = uci.slice(0,2), to = uci.slice(2,4);
      this.drawArrowOnLayer(this.gUser, from, to, this.colorToCss(colorKey), sw, key);
    }
  }
  redrawUserCircles(){
    if (!this.gMarks) return;
    this.gMarks.innerHTML = '';
    const sw = Math.max(8, Math.floor(this.cell*0.14));
    for (const key of this.userCircles){
      const [sq, colorKey='g'] = key.split(':');
      this.drawCircleOnLayer(this.gMarks, sq, this.colorToCss(colorKey), sw, key);
    }
  }
  redrawUserDrawings(){ this.redrawUserArrows(); this.redrawUserCircles(); }

  getUserDrawings(){
    return {
      arrows: Array.from(this.userArrows).map(k => {
        const [uci, color='g'] = k.split(':'); return { uci, color };
      }),
      circles: Array.from(this.userCircles).map(k => {
        const [sq, color='g'] = k.split(':'); return { sq, color };
      })
    };
  }
  setUserDrawings({ arrows=[], circles=[] } = {}){
    this.clearUserArrows(); this.clearUserCircles();
    for (const a of arrows){
      const color = (a.color||'g'); const key = `${a.uci}:${color}`;
      this.userArrows.add(key);
    }
    for (const c of circles){
      const color = (c.color||'g'); const key = `${c.sq}:${color}`;
      this.userCircles.add(key);
    }
    this.redrawUserDrawings();
  }

  // ---------- Right-click drawing ----------
  colorFromMods(e){
    if (e.shiftKey) return 'r';         // red
    if (e.altKey) return 'y';           // yellow
    if (e.ctrlKey || e.metaKey) return 'b'; // blue
    return 'g';                         // green default
  }
  colorToCss(key){
    return ({ g:'#39d98a', r:'#ff5d5d', y:'#ffd166', b:'#69a7ff' })[key] || '#39d98a';
  }

  attachRightDragToDraw(){
    const onMouseDown = (e) => {
      const isRight = (e.button === 2) || (e.buttons & 2) || (!!e.ctrlKey && e.button === 0);
      if (!isRight) return;
      const fromSq = this._coordsToSquare(e);
      if (!fromSq) return;

      e.preventDefault();
      const modKey = this.colorFromMods(e);
      this.drawStart = { fromSq, x0: e.clientX, y0: e.clientY, modKey };
      this.renderPreview(fromSq, fromSq, modKey);

      const move = (ev) => {
        if (!this.drawStart) return;
        const toSq = this._coordsToSquare(ev) || this.drawStart.fromSq;
        this.renderPreview(this.drawStart.fromSq, toSq, this.drawStart.modKey);
      };
      const up = (ev) => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.finishRightDrag(ev);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);

      // While dragging, suppress contextmenu globally to avoid OS menu
      const blockCtx = (ev) => ev.preventDefault();
      document.addEventListener('contextmenu', blockCtx, { capture:true, once:true });
    };

    if (window.PointerEvent){
      this.boardEl.addEventListener('pointerdown', (e) => {
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
    const movedEnough = (dx*dx + dy*dy) > 16; // 4px

    const colorKey = start.modKey || 'g';
    const color = this.colorToCss(colorKey);
    const sw = Math.max(8, Math.floor(this.cell*0.14));

    // Short click / tiny drag => toggle circle
    if (!movedEnough || toSq === start.fromSq){
      const key = `${start.fromSq}:${colorKey}`;
      if (this.userCircles.has(key)){
        this.userCircles.delete(key);
        this.gMarks.querySelector(`[data-circle="${key}"]`)?.remove();
      } else {
        this.userCircles.add(key);
        this.drawCircleOnLayer(this.gMarks, start.fromSq, color, sw, key);
      }
      return;
    }

    // Real drag => toggle arrow
    const uci = start.fromSq + toSq;
    const akey = `${uci}:${colorKey}`;
    if (this.userArrows.has(akey)){
      this.userArrows.delete(akey);
      this.gUser.querySelector(`[data-uci="${akey}"]`)?.remove();
    } else {
      this.userArrows.add(akey);
      this.drawArrowOnLayer(this.gUser, start.fromSq, toSq, color, sw, akey);
    }
  }

  renderPreview(fromSq, toSq, colorKey='b'){
    if (!this.gPreview) return;
    this.gPreview.innerHTML = '';
    if (!fromSq || !toSq) return;
    const color = this.colorToCss(colorKey);
    const sw = Math.max(7, Math.floor(this.cell*0.12));
    this.drawArrowOnLayer(this.gPreview, fromSq, toSq, `${color}80`, sw); // 50% alpha via hex
  }

  // ---------- Low-level drawing helpers ----------
  drawArrowOnLayer(layer, fromSq, toSq, color, sw, dataKey=null){
    const a = this.squareCenter(fromSq);
    const b = this.squareCenter(toSq);
    const ux = (b.x - a.x), uy = (b.y - a.y);
    const len = Math.hypot(ux,uy) || 1;
    const nx = ux/len, ny = uy/len;
    const head = Math.min(18, Math.max(12, this.cell*0.22));
    const w = Math.min(9, Math.max(6, this.cell*0.11));

    // shaft
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', sw);
    line.setAttribute('stroke-linecap', 'round');

    // head
    const tri = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    const hx = b.x - nx*head, hy = b.y - ny*head, npx=-ny, npy=nx;
    tri.setAttribute('points', `${b.x},${b.y} ${hx+npx*w},${hy+npy*w} ${hx-npx*w},${hy-npy*w}`);
    tri.setAttribute('fill', color);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    if (dataKey) g.setAttribute('data-uci', dataKey);
    g.appendChild(line); g.appendChild(tri);
    layer.appendChild(g);
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

  // ---------- Optional no-op stubs (keeps other app code happy) ----------
  setFen(){ /* no-op here */ }
  renderPosition(){ /* no-op here */ }
  needsPromotion(){ return false; }
  pickPromotion(){ return Promise.resolve(null); }
  celebrate(){ /* optional */ }
  stopCelebration(){ /* optional */ }
}

export default BoardUI;
