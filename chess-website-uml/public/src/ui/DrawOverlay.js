
// public/src/ui/DrawOverlay.js
// Right-click drawing overlay (v3)
//
// NEW in v3:
// - Left click anywhere on the board clears all drawings (and clears system arrows group too).
// - After user action (left pointer up), drawings are automatically cleared (recorded to a local snapshot stack).
// - Arrow keys restore snapshots best-effort: ← restores previous snapshot, → clears to forward state.
// - Bigger arrowheads; shaft ends before the head so the tip is never "inside" the line.
// - Robust pointer vs mouse handling; reliable preview teardown.
//
// Colors: none=green, Shift=red, Alt=yellow, Ctrl/⌘=blue.

(function(){
  'use strict';

  function colorFromMods(e){
    if (e.shiftKey) return 'r';
    if (e.altKey) return 'y';
    if (e.ctrlKey || e.metaKey) return 'b';
    return 'g';
  }
  function colorToCss(key){
    switch (key){
      case 'r': return '#ff5d5d';
      case 'y': return '#ffd166';
      case 'b': return '#69a7ff';
      default:  return '#39d98a'; // g
    }
  }

  const FILES = ['a','b','c','d','e','f','g','h'];
  function squareAt(cell, orientation, x, y){
    if (!cell) return null;
    const orientWhite = (orientation === 'white');
    const file = Math.max(0, Math.min(7, Math.floor(x / cell)));
    const rank = Math.max(0, Math.min(7, Math.floor(y / cell)));
    const xf = orientWhite ? file : 7 - file;
    const yr = orientWhite ? 7 - rank : rank;
    return `${FILES[xf]}${yr+1}`;
  }
  function squareCenter(square, cell, orientation){
    const f = square.charCodeAt(0) - 97;
    const r = parseInt(square[1],10) - 1;
    const orientWhite = (orientation === 'white');
    const x = orientWhite ? f : (7 - f);
    const y = orientWhite ? (7 - r) : r;
    return { x: (x + 0.5)*cell, y: (y + 0.5)*cell };
  }

  function ensureOverlay(boardEl){
    let svg = boardEl.querySelector('#arrowSvg, svg.draw-overlay');
    if (!svg){
      svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('id', 'arrowSvg');
      svg.classList.add('draw-overlay');
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      svg.style.pointerEvents = 'none';
      boardEl.appendChild(svg);
    }
    svg.innerHTML = '';
    const gUser = document.createElementNS('http://www.w3.org/2000/svg','g'); gUser.setAttribute('class','user-arrows');
    const gSys = document.createElementNS('http://www.w3.org/2000/svg','g'); gSys.setAttribute('class','sys-arrows');
    const gPreview = document.createElementNS('http://www.w3.org/2000/svg','g'); gPreview.setAttribute('class','preview-arrow');
    const gMarks = document.createElementNS('http://www.w3.org/2000/svg','g'); gMarks.setAttribute('class','user-marks');
    svg.appendChild(gUser); svg.appendChild(gSys); svg.appendChild(gPreview); svg.appendChild(gMarks);
    return { svg, gUser, gSys, gPreview, gMarks };
  }

  function drawArrowOnLayer(layer, fromSq, toSq, color, sw, cell, orientation, dataKey){
    const a = squareCenter(fromSq, cell, orientation);
    const b = squareCenter(toSq, cell, orientation);
    const ux = (b.x - a.x), uy = (b.y - a.y);
    const len = Math.hypot(ux,uy) || 1;
    const nx = ux/len, ny = uy/len;
    const headLen = Math.max(cell*0.28, 18);
    const headW   = Math.max(sw*1.0, cell*0.18);
    const sx2 = b.x - nx*headLen;
    const sy2 = b.y - ny*headLen;

    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', sx2); line.setAttribute('y2', sy2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', sw);
    line.setAttribute('stroke-linecap', 'round');

    const npx = -ny, npy = nx;
    const tri = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    tri.setAttribute('points', `${b.x},${b.y} ${sx2+npx*headW},${sy2+npy*headW} ${sx2-npx*headW},${sy2-npy*headW}`);
    tri.setAttribute('fill', color);
    tri.setAttribute('stroke', color);
    tri.setAttribute('stroke-linejoin', 'round');
    tri.setAttribute('stroke-width', Math.max(1, sw*0.25));

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    if (dataKey) g.setAttribute('data-uci', dataKey);
    g.appendChild(line); g.appendChild(tri);
    layer.appendChild(g);
  }

  function drawCircleOnLayer(layer, sq, color, sw, cell, orientation, dataKey){
    const c = squareCenter(sq, cell, orientation);
    const r = cell * 0.36;
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

  function DrawOverlay(boardEl){
    this.boardEl = boardEl;
    const cs = getComputedStyle(boardEl);
    if (cs.position === 'static') boardEl.style.position = 'relative';

    const { svg, gUser, gSys, gPreview, gMarks } = ensureOverlay(boardEl);
    this.svg = svg; this.gUser = gUser; this.gSys = gSys; this.gPreview = gPreview; this.gMarks = gMarks;

    this.userArrows = new Set();
    this.userCircles = new Set();
    this.drawStart = null;
    this.cell = 0;
    this.orientation = (boardEl.getAttribute('data-orientation') || boardEl.dataset?.orientation) === 'black' ? 'black' : 'white';

    // simple snapshot stack (for ArrowLeft/ArrowRight)
    this._snapshots = []; // array of {arrows:[...], circles:[...]}
    this._cursor = 0;     // points *after* the current state (like history)

    this.updateMetrics();
    this.resizeOverlay();
    this.attachRightDraw();
    this.attachLeftClear(); // clear on left click / pointer-up

    boardEl.addEventListener('contextmenu', (e)=> e.preventDefault(), true);
    window.addEventListener('resize', ()=>{ this.updateMetrics(); this.resizeOverlay(); this.redrawAll(); });

    // keyboard: restore snapshots on arrow keys
    window.addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowLeft'){
        if (this._cursor > 0){
          this._cursor--;
          const snap = this._snapshots[this._cursor];
          this.setUserDrawings(snap);
        }
      } else if (e.key === 'ArrowRight'){
        if (this._cursor < this._snapshots.length){
          this._cursor++;
          // Forward typically means "no helpers"; clear to that snapshot if it exists, else empty.
          const snap = this._snapshots[this._cursor] || {arrows:[],circles:[]};
          this.setUserDrawings(snap);
        }
      }
    });
  }

  DrawOverlay.prototype.updateMetrics = function(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.cell = (size || 0) / 8 || 0;
    const attr = this.boardEl.getAttribute('data-orientation') || this.boardEl.dataset?.orientation;
    if (attr === 'black' || attr === 'white') this.orientation = attr;
  };

  DrawOverlay.prototype.resizeOverlay = function(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    this.svg.style.width = `${size}px`;
    this.svg.style.height = `${size}px`;
  };

  DrawOverlay.prototype.redrawAll = function(){
    this.gUser.innerHTML = '';
    this.gMarks.innerHTML = '';
    const sw = Math.max(8, Math.floor(this.cell*0.14));
    for (const key of this.userArrows){
      const [uci, c='g'] = key.split(':');
      const from = uci.slice(0,2), to = uci.slice(2,4);
      drawArrowOnLayer(this.gUser, from, to, colorToCss(c), sw, this.cell, this.orientation, key);
    }
    for (const key of this.userCircles){
      const [sq, c='g'] = key.split(':');
      drawCircleOnLayer(this.gMarks, sq, colorToCss(c), sw, this.cell, this.orientation, key);
    }
  };

  DrawOverlay.prototype.renderPreview = function(fromSq, toSq, colorKey){
    this.gPreview.innerHTML = '';
    if (!fromSq || !toSq) return;
    const sw = Math.max(7, Math.floor(this.cell*0.12));
    const color = colorToCss(colorKey) + '90'; // ~56% alpha
    drawArrowOnLayer(this.gPreview, fromSq, toSq, color, sw, this.cell, this.orientation);
  };

  DrawOverlay.prototype.attachRightDraw = function(){
    const hasPointer = !!window.PointerEvent;
    const onDown = (e) => {
      const isRight = (e.button === 2) || (e.buttons & 2) || (!!e.ctrlKey && e.button === 0);
      if (!isRight) return;
      const rect = this.boardEl.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const fromSq = squareAt(this.cell, this.orientation, x, y);
      if (!fromSq) return;

      e.preventDefault();
      const modKey = colorFromMods(e);
      this.drawStart = { fromSq, x0: e.clientX, y0: e.clientY, modKey, pointerId: hasPointer ? e.pointerId : -1 };
      this.renderPreview(fromSq, fromSq, modKey);

      const blockCtx = (ev)=> ev.preventDefault();
      document.addEventListener('contextmenu', blockCtx, { capture:true, once:true });

      if (hasPointer){
        const move = (ev) => {
          if (!this.drawStart || (ev.pointerId !== this.drawStart.pointerId)) return;
          const rx = ev.clientX - rect.left, ry = ev.clientY - rect.top;
          const toSq = squareAt(this.cell, this.orientation, rx, ry) || this.drawStart.fromSq;
          this.renderPreview(this.drawStart.fromSq, toSq, this.drawStart.modKey);
        };
        const up = (ev) => {
          if (!this.drawStart || (ev.pointerId !== this.drawStart.pointerId)) return;
          document.removeEventListener('pointermove', move, true);
          document.removeEventListener('pointerup', up, true);
          this.finishRightDrag(ev);
        };
        document.addEventListener('pointermove', move, true);
        document.addEventListener('pointerup', up, true);
      } else {
        const move = (ev) => {
          if (!this.drawStart) return;
          const rx = ev.clientX - rect.left, ry = ev.clientY - rect.top;
          const toSq = squareAt(this.cell, this.orientation, rx, ry) || this.drawStart.fromSq;
          this.renderPreview(this.drawStart.fromSq, toSq, this.drawStart.modKey);
        };
        const up = (ev) => {
          document.removeEventListener('mousemove', move, true);
          document.removeEventListener('mouseup', up, true);
          this.finishRightDrag(ev);
        };
        document.addEventListener('mousemove', move, true);
        document.addEventListener('mouseup', up, true);
      }
    };

    if (hasPointer){
      this.boardEl.addEventListener('pointerdown', onDown);
    } else {
      this.boardEl.addEventListener('mousedown', onDown);
    }
  };

  // Clear on left click / pointer-up:
  DrawOverlay.prototype.attachLeftClear = function(){
    const hasPointer = !!window.PointerEvent;
    const onClear = (e) => {
      const left = (e.button === 0) || (hasPointer && e.pointerType && e.button === 0);
      if (!left) return;
      // Record snapshot then clear
      this.recordSnapshot();
      this.clearAll();
    };
    if (hasPointer){
      this.boardEl.addEventListener('pointerup', onClear);
    } else {
      this.boardEl.addEventListener('mouseup', onClear);
    }
    // Also treat a simple click as clear (as requested)
    this.boardEl.addEventListener('click', (e)=>{
      if (e.button !== 0) return;
      this.recordSnapshot();
      this.clearAll();
    });
  };

  DrawOverlay.prototype.recordSnapshot = function(){
    const snap = this.getUserDrawings();
    this._snapshots.splice(this._cursor); // drop anything ahead
    this._snapshots.push(snap);
    this._cursor = this._snapshots.length;
  };

  DrawOverlay.prototype.finishRightDrag = function(e){
    const start = this.drawStart; this.drawStart = null;
    this.gPreview.innerHTML = '';
    if (!start) return;

    const rect = this.boardEl.getBoundingClientRect();
    const toSq = squareAt(this.cell, this.orientation, e.clientX - rect.left, e.clientY - rect.top) || start.fromSq;
    const dx = e.clientX - start.x0, dy = e.clientY - start.y0;
    const movedEnough = (dx*dx + dy*dy) > 16;

    const colorKey = start.modKey || 'g';
    const color = colorToCss(colorKey);
    const sw = Math.max(8, Math.floor(this.cell*0.14));

    if (!movedEnough || toSq === start.fromSq){
      const ckey = `${start.fromSq}:${colorKey}`;
      if (this.userCircles.has(ckey)){
        this.userCircles.delete(ckey);
        this.gMarks.querySelector(`[data-circle="${ckey}"]`)?.remove();
      } else {
        this.userCircles.add(ckey);
        drawCircleOnLayer(this.gMarks, start.fromSq, color, sw, this.cell, this.orientation, ckey);
      }
      return;
    }

    const uci = start.fromSq + toSq;
    const akey = `${uci}:${colorKey}`;
    if (this.userArrows.has(akey)){
      this.userArrows.delete(akey);
      this.gUser.querySelector(`[data-uci="${akey}"]`)?.remove();
    } else {
      this.userArrows.add(akey);
      drawArrowOnLayer(this.gUser, start.fromSq, toSq, color, sw, this.cell, this.orientation, akey);
    }
  };

  DrawOverlay.prototype.clearAll = function(){
    this.userArrows.clear();
    this.userCircles.clear();
    this.gUser.innerHTML = '';
    this.gMarks.innerHTML = '';
    this.gPreview.innerHTML = '';
    // also clear system arrows if present (engine lines)
    try { this.svg.querySelector('.sys-arrows').innerHTML = ''; } catch {}
  };

  DrawOverlay.prototype.getUserDrawings = function(){
    return {
      arrows: Array.from(this.userArrows).map(k => { const [uci,color='g']=k.split(':'); return {uci,color}; }),
      circles: Array.from(this.userCircles).map(k => { const [sq,color='g']=k.split(':'); return {sq,color}; })
    };
  };
  DrawOverlay.prototype.setUserDrawings = function(obj){
    this.userArrows.clear(); this.userCircles.clear();
    if (obj && Array.isArray(obj.arrows)){
      for (const a of obj.arrows){ this.userArrows.add(`${a.uci}:${a.color||'g'}`); }
    }
    if (obj && Array.isArray(obj.circles)){
      for (const c of obj.circles){ this.userCircles.add(`${c.sq}:${c.color||'g'}`); }
    }
    this.redrawAll();
  };

  document.addEventListener('DOMContentLoaded', function(){
    const boardEl = document.getElementById('board') || document.querySelector('.board, #chessboard, .board-container');
    if (!boardEl) return;
    if (boardEl.__drawOverlay) return;
    boardEl.__drawOverlay = true;
    const inst = new DrawOverlay(boardEl);
    window.DrawOverlayInstance = inst;
  });
})();
