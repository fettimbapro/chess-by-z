
// public/src/ui/DrawOverlay.js
// Standalone drawing overlay for your chess board.
// Adds right-click arrows & circles with color modifiers (Shift=red, Alt=yellow, Ctrl/⌘=blue, none=green).
// Self-initializes on DOMContentLoaded and attaches to #board without modifying your BoardUI.
// No exports required; attaches instance to window.DrawOverlayInstance for debugging.

(function(){
  'use strict';

  function colorFromMods(e){
    if (e.shiftKey) return 'r';
    if (e.altKey) return 'y';
    if (e.ctrlKey || e.metaKey) return 'b';
    return 'g';
  }
  function colorToCss(key){
    switch (key) {
      case 'r': return '#ff5d5d';
      case 'y': return '#ffd166';
      case 'b': return '#69a7ff';
      default:  return '#39d98a'; // g
    }
  }

  function squareAt(boardEl, x, y, cell, orientation){
    if (!cell) return null;
    const FILES = ['a','b','c','d','e','f','g','h'];
    const orientWhite = (orientation === 'white');
    const file = Math.max(0, Math.min(7, Math.floor(x / cell)));
    const rank = Math.max(0, Math.min(7, Math.floor(y / cell)));
    const xf = orientWhite ? file : 7 - file;
    const yr = orientWhite ? 7 - rank : rank;
    return `${FILES[xf]}${yr+1}`;
  }

  function squareCenter(square, cell, orientation){
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1],10) - 1;
    const orientWhite = (orientation === 'white');
    const x = orientWhite ? file : (7 - file);
    const y = orientWhite ? (7 - rank) : rank;
    return {x:(x + 0.5) * cell, y:(y + 0.5) * cell};
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
    // layers
    while (svg.firstChild) svg.removeChild(svg.firstChild);
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

  function getOrientation(boardEl){
    // Try common places to find orientation, fallback to white
    const attr = boardEl.getAttribute('data-orientation') || boardEl.dataset?.orientation;
    if (attr === 'black' || attr === 'white') return attr;
    // Try body/class hint
    if (document.body.classList.contains('black')) return 'black';
    return 'white';
  }

  function DrawOverlay(boardEl){
    this.boardEl = boardEl;
    // Ensure board has positioning for overlay
    const cs = getComputedStyle(boardEl);
    if (cs.position === 'static') boardEl.style.position = 'relative';

    const layers = ensureOverlay(boardEl);
    this.svg = layers.svg;
    this.gUser = layers.gUser;
    this.gSys = layers.gSys;
    this.gPreview = layers.gPreview;
    this.gMarks = layers.gMarks;

    this.userArrows = new Set();   // `${uci}:${colorKey}`
    this.userCircles = new Set();  // `${sq}:${colorKey}`
    this.drawStart = null;
    this.cell = 0;
    this.orientation = getOrientation(boardEl);

    this.updateMetrics();
    this.resizeOverlay();

    // listeners
    this.attachRightDrag();
    this.boardEl.addEventListener('contextmenu', (e)=> e.preventDefault(), true);
    window.addEventListener('resize', ()=>{ this.updateMetrics(); this.resizeOverlay(); this.redrawAll(); });
  }

  DrawOverlay.prototype.updateMetrics = function(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.cell = (size || 0) / 8 || 0;
    this.orientation = getOrientation(this.boardEl);
  };

  DrawOverlay.prototype.resizeOverlay = function(){
    const r = this.boardEl.getBoundingClientRect();
    const size = Math.min(r.width || 0, r.height || 0);
    this.svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    this.svg.style.width = `${size}px`;
    this.svg.style.height = `${size}px`;
  };

  DrawOverlay.prototype.redrawAll = function(){
    this.redrawArrows();
    this.redrawCircles();
  };

  DrawOverlay.prototype.redrawArrows = function(){
    this.gUser.innerHTML = '';
    const sw = Math.max(8, Math.floor(this.cell*0.14));
    for (const key of this.userArrows){
      const [uci, colorKey='g'] = key.split(':');
      const from = uci.slice(0,2), to = uci.slice(2,4);
      drawArrowOnLayer(this.gUser, from, to, colorToCss(colorKey), sw, this.cell, this.orientation, key);
    }
  };

  DrawOverlay.prototype.redrawCircles = function(){
    this.gMarks.innerHTML = '';
    const sw = Math.max(8, Math.floor(this.cell*0.14));
    for (const key of this.userCircles){
      const [sq, colorKey='g'] = key.split(':');
      drawCircleOnLayer(this.gMarks, sq, colorToCss(colorKey), sw, this.cell, this.orientation, key);
    }
  };

  DrawOverlay.prototype.renderPreview = function(fromSq, toSq, colorKey){
    this.gPreview.innerHTML = '';
    if (!fromSq || !toSq) return;
    const sw = Math.max(7, Math.floor(this.cell*0.12));
    const col = colorToCss(colorKey);
    // 50% alpha
    const alphaCol = col + '80';
    drawArrowOnLayer(this.gPreview, fromSq, toSq, alphaCol, sw, this.cell, this.orientation);
  };

  DrawOverlay.prototype.attachRightDrag = function(){
    const onDown = (e) => {
      const isRight = (e.button === 2) || (e.buttons & 2) || (!!e.ctrlKey && e.button === 0);
      if (!isRight) return;
      const rect = this.boardEl.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const fromSq = squareAt(this.boardEl, x, y, this.cell, this.orientation);
      if (!fromSq) return;

      e.preventDefault();
      const modKey = colorFromMods(e);
      this.drawStart = { fromSq, x0: e.clientX, y0: e.clientY, modKey };
      this.renderPreview(fromSq, fromSq, modKey);

      const move = (ev) => {
        if (!this.drawStart) return;
        const rx = ev.clientX - rect.left, ry = ev.clientY - rect.top;
        const toSq = squareAt(this.boardEl, rx, ry, this.cell, this.orientation) || this.drawStart.fromSq;
        this.renderPreview(this.drawStart.fromSq, toSq, this.drawStart.modKey);
      };
      const up = (ev) => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.finishRightDrag(ev);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);

      // Temporarily block contextmenu until mouseup (Safari/Chrome safe)
      const block = (ev) => ev.preventDefault();
      document.addEventListener('contextmenu', block, {capture:true, once:true});
    };

    if (window.PointerEvent){
      this.boardEl.addEventListener('pointerdown', (e)=>{
        const rightish = (e.button===2) || (e.buttons & 2) || (!!e.ctrlKey && e.button===0);
        if (!rightish) return;
        e.preventDefault();
        onDown(e);
      });
    } else {
      this.boardEl.addEventListener('mousedown', onDown);
    }
  };

  DrawOverlay.prototype.finishRightDrag = function(e){
    const start = this.drawStart; this.drawStart = null;
    this.gPreview.innerHTML = '';
    if (!start) return;

    const rect = this.boardEl.getBoundingClientRect();
    const toSq = squareAt(this.boardEl, e.clientX - rect.left, e.clientY - rect.top, this.cell, this.orientation) || start.fromSq;
    const dx = e.clientX - start.x0, dy = e.clientY - start.y0;
    const movedEnough = (dx*dx + dy*dy) > 16; // ~4px
    const colorKey = start.modKey || 'g';
    const color = colorToCss(colorKey);
    const sw = Math.max(8, Math.floor(this.cell*0.14));

    if (!movedEnough || toSq === start.fromSq){
      // toggle circle
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

    // toggle arrow
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

  // Export/Import API on instance
  DrawOverlay.prototype.getUserDrawings = function(){
    return {
      arrows: Array.from(this.userArrows).map(k => { const [uci,color='g']=k.split(':'); return {uci, color}; }),
      circles: Array.from(this.userCircles).map(k => { const [sq,color='g']=k.split(':'); return {sq, color}; })
    };
  };
  DrawOverlay.prototype.setUserDrawings = function(obj){
    this.userArrows.clear(); this.userCircles.clear();
    if (obj && Array.isArray(obj.arrows)){
      for (const a of obj.arrows){ const key = `${a.uci}:${a.color||'g'}`; this.userArrows.add(key); }
    }
    if (obj && Array.isArray(obj.circles)){
      for (const c of obj.circles){ const key = `${c.sq}:${c.color||'g'}`; this.userCircles.add(key); }
    }
    this.redrawAll();
  };
  DrawOverlay.prototype.clearAll = function(){
    this.userArrows.clear();
    this.userCircles.clear();
    this.gUser.innerHTML = '';
    this.gMarks.innerHTML = '';
    this.gPreview.innerHTML = '';
  };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){
    const boardEl = document.getElementById('board') || document.querySelector('.board, #chessboard, .board-container');
    if (!boardEl) return;
    // Avoid double init
    if (boardEl.__drawOverlay) return;
    boardEl.__drawOverlay = true;
    const instance = new DrawOverlay(boardEl);
    window.DrawOverlayInstance = instance;
  });
})();
