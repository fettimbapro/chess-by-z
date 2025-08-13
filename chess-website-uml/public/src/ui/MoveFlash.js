// chess-website-uml/public/src/ui/MoveFlash.js
// Full drop-in replacement: BORDER-ONLY glow with no corner seams, 1500ms default,
// robust first-move detection, and drag anti-blink (capture-phase & multiple event types).
//
// Public API preserved: window.MoveFlash.{attachTo, flash, setColor}
//
(function(){
  'use strict';

  // -------------------- config --------------------
  const CONFIG = {
    duration: 1500,               // default ms
    colorRGB: [160, 210, 255],    // base glow color (RGB). Alpha is animated.
    peakAlpha: 0.46,              // slightly brighter
    pointerTailMs: 260,           // suppression after pointerup / dragend
    minSqBuildIgnore: 24          // if going from 0 squares to >= this in one batch, treat as initial build and ignore
  };

  // -------------------- utils --------------------
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const easeInOutCubic = (t) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2);

  function rgba(rgb, a){
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  }

  // -------------------- styles --------------------
  function injectStyle(){
    if (document.getElementById('move-flash-style')) return;
    const st = document.createElement('style');
    st.id = 'move-flash-style';
    st.textContent = `
      .mf-card-host { position: relative; isolation: isolate; }
      canvas.mf-overlay-canvas {
        position: absolute; inset: 0; pointer-events: none; display: block;
        z-index: 2; mix-blend-mode: screen;
      }
    `;
    document.head.appendChild(st);
  }

  // -------------------- DOM helpers --------------------
  function findBoard(){
    return (
      document.getElementById('board') ||
      document.querySelector('.board, #chessboard, .board-container, [data-board], [data-board-root], [data-chess-board]')
    );
  }

  function findCard(boardEl){
    let card = boardEl.closest?.('[data-board-card]');
    if (!card) card = boardEl.closest?.('.card, .panel, .surface, .box, .tile, .wrapper, .container, .pane, .paper');
    return card || boardEl.parentElement || boardEl;
  }

  function ensureCanvas(card){
    card.classList.add('mf-card-host');
    let cvs = card.querySelector(':scope > canvas.mf-overlay-canvas');
    if (!cvs){
      cvs = document.createElement('canvas');
      cvs.className = 'mf-overlay-canvas';
      card.appendChild(cvs);
    }
    const cs = getComputedStyle(card);
    if (cs.position === 'static') card.style.position = 'relative';
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

  function getRects(card, board){
    const c = card.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    return {
      cardW: c.width,
      cardH: c.height,
      L: b.left - c.left,
      T: b.top - c.top,
      R: b.right - c.left,
      B: b.bottom - c.top
    };
  }

  // -------------------- drawing --------------------
  // Single-pass ring: clip to (outer card) minus (inner board), then stroke inner rect with shadow.
  // This avoids corner seams because the glow is produced by one stroke's shadow, not four bands.
  function drawBorderGlow(ctx, cardW, cardH, L, T, R, B, rgb, alpha){
    ctx.clearRect(0,0,cardW,cardH);
    if (alpha <= 0) return;

    const innerW = Math.max(0, R - L);
    const innerH = Math.max(0, B - T);
    if (innerW === 0 || innerH === 0) return;

    const glow = rgba(rgb, alpha);
    const strokeW = Math.max(8, Math.min(cardW, cardH) * 0.03); // thickness influences shadow spread
    const blur = Math.max(16, Math.min(cardW, cardH) * 0.09);

    ctx.save();
    // Clip to ring region (outer minus inner)
    ctx.beginPath();
    ctx.rect(0,0,cardW,cardH);
    ctx.rect(L, T, innerW, innerH);
    ctx.clip('evenodd');

    // Draw shadowed inner stroke; shadow will land only in the clipped ring
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = 'rgba(0,0,0,0)'; // invisible stroke, we only want the shadow
    ctx.lineWidth = strokeW;

    // Pixel-align for crisp shadow edge
    const half = ctx.lineWidth % 2 ? 0.5 : 0;
    ctx.strokeRect(L + half, T + half, innerW - ctx.lineWidth + (ctx.lineWidth % 2), innerH - ctx.lineWidth + (ctx.lineWidth % 2));
    ctx.restore();
  }

  // -------------------- core API --------------------
  const API = {
    ready: false,
    card: null,
    board: null,
    canvas: null,
    ctx: null,
    _state: {
      colorRGB: CONFIG.colorRGB.slice(),
      duration: CONFIG.duration,
      peakAlpha: CONFIG.peakAlpha,
      isPointerDown: false,
      lastPointerTs: 0,
      lastSqCount: 0,
      bootSeen: false,
      animRAF: 0
    },

    attachTo(boardEl){
      try{
        injectStyle();
        const card = findCard(boardEl);
        const canvas = ensureCanvas(card);
        resizeCanvas(canvas);
        const ctx = canvas.getContext('2d');

        // Initialize square count to detect initial board build
        this._state.lastSqCount = boardEl.querySelectorAll('.sq').length;
        this._state.bootSeen = this._state.lastSqCount > 0;

        // Strong drag suppression: capture-phase & multiple event types
        const onDown = () => { this._state.isPointerDown = true; this._state.lastPointerTs = now(); };
        const onUp   = () => { this._state.isPointerDown = false; this._state.lastPointerTs = now(); };
        ['pointerdown','mousedown','touchstart','dragstart'].forEach(ev =>
          boardEl.addEventListener(ev, onDown, { passive: true, capture: true }));
        ['pointerup','mouseup','touchend','touchcancel','dragend','drop'].forEach(ev =>
          boardEl.addEventListener(ev, onUp, { passive: true, capture: true }));

        // Observe board changes
        const obs = new MutationObserver((list)=>{
          // Ensure canvas is connected
          if (!canvas.isConnected){
            const c2 = ensureCanvas(card);
            resizeCanvas(c2);
            this.canvas = c2;
            this.ctx = c2.getContext('2d');
          }

          // Only react to relevant .sq changes
          let touched = false;
          for (const m of list){
            const t = m.target;
            if (t && t.nodeType === 1){
              const el = /** @type {Element} */(t);
              if (el.classList.contains('sq') || el.closest?.('.sq')){ touched = true; break; }
            }
          }
          if (!touched) return;

          // First-move gating: treat a batch that builds many squares as initial layout
          const curSq = boardEl.querySelectorAll('.sq').length;
          if (!this._state.bootSeen){
            if (this._state.lastSqCount === 0 && curSq >= CONFIG.minSqBuildIgnore){
              // Initial board build; mark seen and skip pulse
              this._state.bootSeen = true;
              this._state.lastSqCount = curSq;
              return;
            } else {
              // Squares already existed at attach; mark boot seen so future changes can pulse
              this._state.bootSeen = true;
            }
          }
          this._state.lastSqCount = curSq;

          // Drag suppression
          if (this._state.isPointerDown) return;
          if (now() - this._state.lastPointerTs < CONFIG.pointerTailMs) return;

          this.flash();
        });
        obs.observe(boardEl, {
          subtree:true, childList:true, characterData:true, attributes:true,
          attributeFilter:['class','style','data-square','data-piece']
        });

        // Engine events (optional)
        const pulse = ()=> this.flash();
        ['engine:move','ai:move','game:engineMove','uci:bestmove'].forEach(name => {
          document.addEventListener(name, pulse);
        });

        // Resize
        const onResize = () => { if (this.canvas) resizeCanvas(this.canvas); };
        window.addEventListener('resize', onResize, { passive: true });

        // Store
        this.card = card;
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

      if (!this.canvas || !this.ctx || !this.card || !this.board) return;
      resizeCanvas(this.canvas);

      const { cardW, cardH, L, T, R, B } = getRects(this.card, this.board);
      const start = now();

      // Cancel any running anim to prevent flicker races
      if (this._state.animRAF) cancelAnimationFrame(this._state.animRAF);

      const step = () => {
        const t = (now() - start) / dur;
        const p = clamp(t, 0, 1);
        const tri = p < 0.5 ? (p / 0.5) : (1 - (p - 0.5)/0.5);
        const eased = easeInOutCubic(tri);
        const alpha = this._state.peakAlpha * eased;
        drawBorderGlow(this.ctx, cardW, cardH, L, T, R, B, rgb, alpha);

        if (p < 1){
          this._state.animRAF = requestAnimationFrame(step);
        } else {
          this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
          this._state.animRAF = 0;
        }
      };
      this._state.animRAF = requestAnimationFrame(step);
    },

    setColor(color){
      // Accept 'rgb(r,g,b)' or '#RRGGBB' or array
      if (Array.isArray(color) && color.length === 3){
        this._state.colorRGB = color.slice();
        return;
      }
      if (typeof color === 'string'){
        const m = color.match(/#([0-9a-f]{6})/i);
        if (m){
          const hex = m[1];
          const r = parseInt(hex.slice(0,2),16);
          const g = parseInt(hex.slice(2,4),16);
          const b = parseInt(hex.slice(4,6),16);
          this._state.colorRGB = [r,g,b];
          return;
        }
        const m2 = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (m2){
          this._state.colorRGB = [ +m2[1], +m2[2], +m2[3] ];
          return;
        }
      }
      // Fallback to default
      this._state.colorRGB = CONFIG.colorRGB.slice();
    }
  };

  // expose
  window.MoveFlash = API;

  // auto attach
  function auto(){
    injectStyle();
    let board = findBoard();
    if (board){
      API.attachTo(board);
      return;
    }
    const mo = new MutationObserver(()=>{
      board = findBoard();
      if (board){
        mo.disconnect();
        API.attachTo(board);
      }
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', auto, { once:true });
  } else {
    auto();
  }
})();