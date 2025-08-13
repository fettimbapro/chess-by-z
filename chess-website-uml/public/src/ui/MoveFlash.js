
// public/src/ui/MoveFlash.js
// Light-blue "move flash" on the board's card whenever board squares change.
//
// v2 improvements:
// - Always defines window.MoveFlash immediately, so calling it never returns undefined.
// - Auto-attaches to #board even if it appears later (observes DOM for insertion).
// - Exposes MoveFlash.attachTo(el) to manually bind to a custom board element.
// - Purely additive; no app code changes required.

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
        12%  { opacity: .75; }
        100% { opacity: 0; }
      }
      .move-flash-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        opacity: 0;
        will-change: opacity;
        background: radial-gradient(120% 120% at 50% 100%, rgba(127,179,255,.22), rgba(127,179,255,0) 60%), linear-gradient(rgba(127,179,255,.22), rgba(127,179,255,.22));
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- DOM helpers ----------
  function findCard(boardEl){
    let card = boardEl.closest('[data-board-card]');
    if (card) return card;
    card = boardEl.closest('.card, .panel, .surface, .box, .tile, .wrapper, .container, .pane, .paper');
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
      overlay.style.background = `radial-gradient(120% 120% at 50% 100%, ${color}, rgba(127,179,255,0) 60%), linear-gradient(${color}, ${color})`;
    }
    overlay.style.animation = 'none';
    // force reflow
    // eslint-disable-next-line no-unused-expressions
    overlay.offsetHeight;
    overlay.style.animation = `moveFlashPulse ${duration}ms ease-out 1`;
  }

  // ---------- observer ----------
  function watchBoard(boardEl, overlay){
    // Skip if already attached
    if (boardEl.__moveFlashAttached) return;
    boardEl.__moveFlashAttached = true;

    // Avoid flashing on first render
    let ready = false;
    setTimeout(()=> ready = true, 300);

    const obs = new MutationObserver((list)=>{
      if (!ready) return;
      for (const m of list){
        const t = m.target;
        if (t && t.nodeType === 1){
          const el = /** @type {Element} */(t);
          if (el.classList.contains('sq') || el.closest?.('.sq')){
            doFlash(overlay);
            break;
          }
        }
      }
    });
    obs.observe(boardEl, { subtree:true, childList:true, characterData:true });
    return obs;
  }

  // ---------- public API (created immediately) ----------
  const API = {
    ready: false,
    overlay: null,
    card: null,
    observer: null,
    // manual attach: MoveFlash.attachTo(el)
    attachTo(el){
      try {
        injectStyle();
        const card = findCard(el);
        const overlay = ensureOverlay(card);
        if (this.observer) { try{ this.observer.disconnect(); }catch{} }
        this.observer = watchBoard(el, overlay);
        this.overlay = overlay;
        this.card = card;
        this.ready = true;
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
      this.overlay.style.background = `radial-gradient(120% 120% at 50% 100%, ${color}, rgba(127,179,255,0) 60%), linear-gradient(${color}, ${color})`;
    }
  };
  // expose immediately so window.MoveFlash is never undefined
  window.MoveFlash = API;

  // Auto-attach when #board is present (even if inserted later)
  function auto(){
    injectStyle();
    // If board exists now
    let board = document.getElementById('board') || document.querySelector('.board, #chessboard, .board-container');
    if (board){ API.attachTo(board); return; }
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
