// public/src/ui/MoveFlash.js
// Engine-only board-card pulse. Backward-compatible drop-in.
// - Keeps the original API & behavior (window.MoveFlash, .attachTo, .flash, .setColor).
// - Adds user-move suppression (pointer grace window) so pulses happen only for engine moves.
// - Also listens for common engine events: 'engine:move', 'ai:move', 'game:engineMove', 'uci:bestmove'.
//
// How it decides to pulse:
//   1) If any of the engine events fire → pulse immediately.
//   2) Otherwise, if the board DOM changes *and* there was no pointer activity in the last 500ms → pulse.
//   3) Ignores initial render for 300ms after attaching.
//
// You can still trigger manually with: MoveFlash.flash({duration, color})
//
(function(){
  'use strict';

  // ---------- style ----------
  function injectStyle(){
    if (document.getElementById('move-flash-style')) return;
    const st = document.createElement('style');
    st.id = 'move-flash-style';
    st.textContent = `
      @keyframes moveFlashPulse {
        0%   { opacity: 0; }
        10%  { opacity: .85; }
        100% { opacity: 0; }
      }
      .move-flash-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        opacity: 0;
        will-change: opacity;
        background:
          radial-gradient(120% 120% at 50% 100%, rgba(127,179,255,.22), rgba(127,179,255,0) 60%),
          linear-gradient(rgba(127,179,255,.22), rgba(127,179,255,.22));
        /* Ensure it sits visually above bg but below content stacking by default */
        z-index: 0;
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- DOM helpers ----------
  function findCard(boardEl){
    let card = boardEl.closest?.('[data-board-card]');
    if (card) return card;
    card = boardEl.closest?.('.card, .panel, .surface, .box, .tile, .wrapper, .container, .pane, .paper');
    return card || boardEl;
  }

  function ensureOverlay(card){
    let ol = card.querySelector(':scope > .move-flash-overlay');
    if (!ol){
      ol = document.createElement('div');
      ol.className = 'move-flash-overlay';
      card.appendChild(ol);
    }
    const cs = getComputedStyle(card);
    if (cs.position === 'static') card.style.position = 'relative';
    return ol;
  }

  // ---------- flash ----------
  function doFlash(overlay, duration=500, color){
    if (!overlay) return;
    if (color) {
      overlay.style.background =
        `radial-gradient(120% 120% at 50% 100%, ${color}, rgba(127,179,255,0) 60%), linear-gradient(${color}, ${color})`;
    }
    overlay.style.animation = 'none'; // force reflow
    // eslint-disable-next-line no-unused-expressions
    overlay.offsetHeight;
    overlay.style.animation = `moveFlashPulse ${duration}ms ease-out 1`;
  }

  // ---------- observer + heuristics ----------
  function watchBoard(boardEl, overlay, heur){
    // Skip if already attached
    if (boardEl.__moveFlashAttached) return;
    boardEl.__moveFlashAttached = true;

    const { pointerGraceMs } = heur;

    // Avoid flashing on first render
    let ready = false;
    setTimeout(()=> ready = true, 300);

    const obs = new MutationObserver((list)=>{
      if (!ready) return;

      const sincePointer = performance.now() - heur.lastPointerTs;
      // Only react if there were square-related mutations
      let touchedSquares = false;
      for (const m of list){
        const t = m.target;
        if (t && t.nodeType === 1){
          const el = /** @type {Element} */(t);
          if (el.classList.contains('sq') || el.closest?.('.sq')){
            touchedSquares = true;
            break;
          }
        }
      }
      if (!touchedSquares) return;

      if (sincePointer > pointerGraceMs){
        doFlash(overlay);
      }
    });

    // Observe common board updates
    obs.observe(boardEl, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class','style','data-piece','data-square']
    });

    return obs;
  }

  // ---------- public API (created immediately) ----------
  const API = {
    ready: false,
    overlay: null,
    card: null,
    observer: null,
    _heur: {
      lastPointerTs: 0,
      pointerGraceMs: 500
    },
    // manual attach: MoveFlash.attachTo(el)
    attachTo(el){
      try {
        injectStyle();
        const card = findCard(el);
        const overlay = ensureOverlay(card);

        // Pointer tracking to suppress human moves
        const onPointer = ()=>{ this._heur.lastPointerTs = performance.now(); };
        el.addEventListener('pointerdown', onPointer, { passive: true });
        el.addEventListener('pointerup', onPointer, { passive: true });

        if (this.observer) {
          try{ this.observer.disconnect(); }catch{}
        }
        this.observer = watchBoard(el, overlay, this._heur);
        this.overlay = overlay;
        this.card = card;
        this.ready = true;

        // Engine event listeners (best-effort)
        const pulse = ()=> this.flash();
        this._engineEvts = ['engine:move','ai:move','game:engineMove','uci:bestmove'];
        this._engineEvts.forEach(name => document.addEventListener(name, pulse));
        this._pulseHandler = pulse;
      } catch (err) {
        console.error('MoveFlash.attachTo failed:', err);
      }
    },
    // manual flash: MoveFlash.flash({duration, color})
    flash(opts){
      opts = opts || {};
      const dur = typeof opts.duration === 'number' ? opts.duration : 500;
      const col = opts.color;
      if (this.overlay) doFlash(this.overlay, dur, col);
    },
    // allow custom color to be set/persisted
    setColor(color){
      if (!this.overlay) return;
      this.overlay.style.background =
        `radial-gradient(120% 120% at 50% 100%, ${color}, rgba(127,179,255,0) 60%), linear-gradient(${color}, ${color})`;
    },
    // optionally tweak suppression window at runtime
    setPointerGrace(ms){
      const v = Math.max(0, Number(ms)||0);
      this._heur.pointerGraceMs = v;
    },
    // cleanup if needed
    detach(){
      try{
        if (this.observer) this.observer.disconnect();
        if (this._engineEvts && this._pulseHandler){
          this._engineEvts.forEach(name => document.removeEventListener(name, this._pulseHandler));
        }
      }catch{}
      this.ready = false;
    }
  };

  // expose immediately so window.MoveFlash is never undefined
  window.MoveFlash = API;

  // Auto-attach when #board is present (even if inserted later)
  function auto(){
    injectStyle();
    // If board exists now
    let board = document.getElementById('board') || document.querySelector('.board, #chessboard, .board-container');
    if (board){
      API.attachTo(board);
      return;
    }
    // Otherwise, observe DOM until it appears
    const mo = new MutationObserver(()=>{
      board = document.getElementById('board') || document.querySelector('.board, #chessboard, .board-container');
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