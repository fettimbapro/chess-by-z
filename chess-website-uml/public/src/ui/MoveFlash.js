// chess-website-uml/public/src/ui/MoveFlash.js
// BORDER-ONLY glow (seamless ring) focused on the `.board-wrap` card background.
//  - Default 1500ms
//  - Draws only in the area around the board (not over it) using canvas + destination-out
//  - Explicitly targets `.board-wrap` as the glow host
//  - Robust board detection & mutation triggers ('.sq', '.square', [data-square], [data-piece])
//  - Anti-blink on drag with delayed first-move pulse if suppressed by pointer tail
//
// Public API: window.MoveFlash.{attachTo, flash, setColor, test}; window.moveflash alias.
//
(function(){
  'use strict';

  const CONFIG = {
    duration: 1500,
    colorRGB: [160, 210, 255],
    peakAlpha: 0.5,
    pointerTailMs: 220,
    zIndex: 9999
  };

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const easeInOutCubic = (t) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2);
  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

  function injectStyle(){
    if (document.getElementById('move-flash-style')) return;
    const st = document.createElement('style');
    st.id = 'move-flash-style';
    st.textContent = `
      .mf-card-host { position: relative; isolation: isolate; }
      canvas.mf-overlay-canvas {
        position: absolute; inset: 0; pointer-events: none; display: block;
        z-index: ${CONFIG.zIndex}; mix-blend-mode: screen;
      }
    `;
    document.head.appendChild(st);
  }

  function findBoard(){
    // Prefer a board inside a .board-wrap container
    const wrap = document.querySelector('.board-wrap');
    if (wrap){
      const inside = wrap.querySelector('#board, .board, [data-chess-board], [data-board], [data-board-root]');
      if (inside) return inside;
    }
    // Fallbacks
    return (
      document.getElementById('board') ||
      document.querySelector('.board, #chessboard, .board-container, [data-chess-board], [data-board], [data-board-root]')
    );
  }

  function findHost(boardEl){
    // Explicit preference: .board-wrap ancestor
    const wrap = boardEl.closest('.board-wrap');
    if (wrap) return wrap;
    // Fallbacks
    let card = boardEl.closest?.('[data-board-card]');
    if (!card) card = boardEl.closest?.('.card, .panel, .surface, .box, .tile, .wrapper, .container, .pane, .paper');
    return card || boardEl.parentElement || boardEl;
  }

  function ensureCanvas(host){
    host.classList.add('mf-card-host');
    let cvs = host.querySelector(':scope > canvas.mf-overlay-canvas');
    if (!cvs){
      cvs = document.createElement('canvas');
      cvs.className = 'mf-overlay-canvas';
      host.appendChild(cvs);
    }
    const cs = getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    return cvs;
  }

  function resizeCanvas(canvas){
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h){
      canvas.width = w; canvas.height = h;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function getRects(host, board){
    const c = host.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    return { cardW: c.width, cardH: c.height, L: b.left - c.left, T: b.top - c.top, R: b.right - c.left, B: b.bottom - c.top };
  }

  function drawRing(ctx, cardW, cardH, L, T, R, B, rgb, alpha){
    ctx.clearRect(0,0,cardW,cardH);
    if (alpha <= 0) return;
    const innerW = Math.max(0, R - L);
    const innerH = Math.max(0, B - T);
    if (innerW === 0 || innerH === 0) return;

    const glow = rgba(rgb, alpha);
    const strokeW = Math.max(8, Math.min(cardW, cardH) * 0.03);
    const blur = Math.max(16, Math.min(cardW, cardH) * 0.095);

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur  = blur;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineWidth   = strokeW;
    const half = ctx.lineWidth % 2 ? 0.5 : 0;
    ctx.strokeRect(L + half, T + half, innerW - ctx.lineWidth + (ctx.lineWidth % 2), innerH - ctx.lineWidth + (ctx.lineWidth % 2));
    ctx.restore();

    // carve center
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(L, T, innerW, innerH);
    ctx.restore();
  }

  const API = {
    ready: false,
    host: null,
    board: null,
    canvas: null,
    ctx: null,
    _state: {
      colorRGB: CONFIG.colorRGB.slice(),
      duration: CONFIG.duration,
      peakAlpha: CONFIG.peakAlpha,
      isPointerDown: false,
      lastPointerTs: 0,
      animRAF: 0,
      supTimer: 0,
      lastTouchedAt: 0
    },

    attachTo(boardEl){
      try{
        injectStyle();
        const host = findHost(boardEl);
        const canvas = ensureCanvas(host);
        resizeCanvas(canvas);
        const ctx = canvas.getContext('2d');

        const onDown = () => { this._state.isPointerDown = true;  this._state.lastPointerTs = now(); };
        const onUp   = () => { this._state.isPointerDown = false; this._state.lastPointerTs = now(); };
        ['pointerdown','mousedown','touchstart','dragstart'].forEach(ev =>
          boardEl.addEventListener(ev, onDown, { passive: true, capture: true }));
        ['pointerup','mouseup','touchend','touchcancel','dragend','drop'].forEach(ev =>
          boardEl.addEventListener(ev, onUp,   { passive: true, capture: true }));

        const obs = new MutationObserver((list)=>{
          if (!canvas.isConnected){
            const c2 = ensureCanvas(host);
            resizeCanvas(c2);
            this.canvas = c2;
            this.ctx = c2.getContext('2d');
          }

          let touched = false;
          for (const m of list){
            const t = m.target;
            if (t && t.nodeType === 1){
              const el = /** @type {Element} */(t);
              if (
                el.classList.contains('sq') || el.closest?.('.sq') ||
                el.classList.contains('square') || el.closest?.('.square') ||
                el.hasAttribute('data-square') || el.closest?.('[data-square]') ||
                el.hasAttribute('data-piece') || el.closest?.('[data-piece]')
              ){ touched = true; break; }
            }
          }
          if (!touched) return;
          this._state.lastTouchedAt = now();

          const sinceUp = now() - this._state.lastPointerTs;
          if (this._state.isPointerDown || sinceUp < CONFIG.pointerTailMs){
            if (this._state.supTimer) clearTimeout(this._state.supTimer);
            this._state.supTimer = setTimeout(()=>{
              if (now() - this._state.lastTouchedAt >= CONFIG.pointerTailMs - 5){
                this.flash();
              }
            }, CONFIG.pointerTailMs + 10);
            return;
          }

          this.flash();
        });
        obs.observe(boardEl, {
          subtree:true, childList:true, characterData:true, attributes:true,
          attributeFilter:['class','style','data-square','data-piece']
        });

        const pulse = ()=> this.flash();
        [
          'engine:move','ai:move','game:engineMove','uci:bestmove',
          'book:move','opening:move','bookMove','board:update'
        ].forEach(name => document.addEventListener(name, pulse));

        const onResize = () => { if (this.canvas) resizeCanvas(this.canvas); };
        window.addEventListener('resize', onResize, { passive: true });

        this.host = host;
        this.board = boardEl;
        this.canvas = canvas;
        this.ctx = ctx;
        this.ready = true;
      }catch(e){
        console.error('MoveFlash.attachTo failed:', e);
      }
    },

    flash(opts){
      opts = opts || {};
      const dur = typeof opts.duration === 'number' ? opts.duration : this._state.duration;
      const rgb = this._state.colorRGB;
      if (!this.canvas || !this.ctx || !this.host || !this.board) return;
      resizeCanvas(this.canvas);

      const { cardW, cardH, L, T, R, B } = getRects(this.host, this.board);
      const start = now();
      if (this._state.animRAF) cancelAnimationFrame(this._state.animRAF);

      const step = () => {
        const t = (now() - start) / dur;
        const p = clamp(t, 0, 1);
        const tri = p < 0.5 ? (p / 0.5) : (1 - (p - 0.5)/0.5);
        const eased = easeInOutCubic(tri);
        const alpha = this._state.peakAlpha * eased;
        drawRing(this.ctx, cardW, cardH, L, T, R, B, rgb, alpha);
        if (p < 1){
          this._state.animRAF = requestAnimationFrame(step);
        } else {
          this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
          this._state.animRAF = 0;
        }
      };
      this._state.animRAF = requestAnimationFrame(step);
    },

    setColor(value){
      if (Array.isArray(value) && value.length === 3){ this._state.colorRGB = value.slice(); return; }
      if (typeof value === 'string'){
        const m = value.match(/#([0-9a-f]{6})/i);
        if (m){
          const hex = m[1];
          this._state.colorRGB = [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
          return;
        }
        const m2 = value.match(/rgb\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)/i);
        if (m2){ this._state.colorRGB = [ +m2[1], +m2[2], +m2[3] ]; return; }
      }
      this._state.colorRGB = [160,210,255];
    },

    // Debug helper
    test(){ this.setColor('rgb(190,230,255)'); this.flash({ duration: 1500 }); }
  };

  window.MoveFlash = API;
  window.moveflash = API;

  function auto(){
    injectStyle();
    let board = findBoard();
    if (board){ API.attachTo(board); return; }
    const mo = new MutationObserver(()=>{
      board = findBoard();
      if (board){ mo.disconnect(); API.attachTo(board); }
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', auto, { once:true });
  } else {
    auto();
  }
})();