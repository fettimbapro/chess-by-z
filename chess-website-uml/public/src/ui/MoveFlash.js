// chess-website-uml/public/src/ui/MoveFlash.js
// BORDER-ONLY glow via CSS box-shadow on `.board-wrap`, **opponent-only** with
// delayed book-move pulse when engine replies instantly after your click.
//
// Public API: window.MoveFlash.{attachTo, flash, setColor, test}; window.moveflash alias.
//
(function(){
  'use strict';

  const CONFIG = {
    duration: 1500,
    color: 'rgb(160,210,255)',
    peak: 0.55,
    pointerTailMs: 420   // classify board changes within this window after a pointer as user-driven
  };

  // ---------- styles ----------
  function injectStyle(){
    if (document.getElementById('move-flash-style')) return;
    const st = document.createElement('style');
    st.id = 'move-flash-style';
    st.textContent = `
      .mf-host { position: relative; }
      @keyframes mfPulse {
        0%   { box-shadow: 0 0 0 0 rgba(160,210,255, 0); }
        18%  { box-shadow: 0 0 34px 16px rgba(160,210,255, VAR), 0 0 3px 1px rgba(160,210,255, VAR); }
        100% { box-shadow: 0 0 0 0 rgba(160,210,255, 0); }
      }
      .mf-pulse { will-change: box-shadow; }
    `.replace(/VAR/g, String(CONFIG.peak));
    document.head.appendChild(st);
  }

  // ---------- DOM helpers ----------
  function findBoard(){
    const wrap = document.querySelector('.board-wrap');
    if (wrap){
      const inside = wrap.querySelector('#board, .board, [data-chess-board], [data-board], [data-board-root]');
      if (inside) return inside;
    }
    return (
      document.getElementById('board') ||
      document.querySelector('.board, #chessboard, .board-container, [data-chess-board], [data-board], [data-board-root]')
    );
  }
  function findHost(boardEl){
    return boardEl.closest('.board-wrap') || boardEl.parentElement || boardEl;
  }

  // Determine occupant color of a square element
  function colorOfSquare(el){
    // 1) data-piece like "wP" / "bq"
    const dp = el.getAttribute('data-piece');
    if (dp && /^[wb]/i.test(dp)) return dp[0].toLowerCase();

    // 2) class tokens like "pw" / "pb" or "white"/"black"
    for (const cls of el.classList){
      if (cls === 'pw' || cls === 'white' || cls === 'w') return 'w';
      if (cls === 'pb' || cls === 'black' || cls === 'b') return 'b';
    }

    // 3) child piece elements
    const pieceChild = el.querySelector('.piece.white, .white, .pw, .piece.black, .black, .pb');
    if (pieceChild){
      if (pieceChild.classList.contains('white') || pieceChild.classList.contains('pw')) return 'w';
      if (pieceChild.classList.contains('black') || pieceChild.classList.contains('pb')) return 'b';
    }

    // 4) text content heuristic: uppercase = white, lowercase = black (common FEN letter render)
    const txt = el.textContent || '';
    const m = txt.match(/[prnbqkPRNBQK]/);
    if (m){
      return (m[0] === m[0].toUpperCase()) ? 'w' : 'b';
    }

    return null;
  }

  // Snapshot of board: { 'e4': 'w'|'b'|null }
  function readSnapshot(boardEl){
    const map = Object.create(null);
    const nodes = boardEl.querySelectorAll('.sq[data-square]');
    nodes.forEach(el => {
      const sq = el.getAttribute('data-square');
      map[sq] = colorOfSquare(el);
    });
    return map;
  }

  // Color that appeared on any square (destination color)
  function detectMovedColor(prev, next){
    let addW = 0, addB = 0;
    for (const sq in next){
      const a = prev[sq] || null;
      const b = next[sq] || null;
      if (a !== b && b){
        if (b === 'w') addW++; else addB++;
      }
    }
    if (addW === 0 && addB === 0){
      // only removals: infer opposite color moved
      let decW = 0, decB = 0;
      for (const sq in next){
        const a = prev[sq] || null, b = next[sq] || null;
        if (a && !b){ if (a === 'w') decW++; else decB++; }
      }
      if (decW !== decB) return decW > decB ? 'w' : 'b';
      return null;
    }
    return addW >= addB ? (addW ? 'w' : null) : 'b';
  }

  // ---------- core ----------
  const API = {
    ready: false,
    host: null,
    board: null,
    _state: {
      color: CONFIG.color,
      duration: CONFIG.duration,
      isPointerDown: false,
      lastPointerTs: 0,
      humanColor: null,
      snapshot: null,
      rafId: 0,
      delayedTimer: 0
    },

    attachTo(boardEl){
      try{
        injectStyle();
        const host = findHost(boardEl);
        host.classList.add('mf-host');

        const markDown = () => { this._state.isPointerDown = true;  this._state.lastPointerTs = performance.now(); };
        const markUp   = () => { this._state.isPointerDown = false; this._state.lastPointerTs = performance.now(); };
        ['pointerdown','mousedown','touchstart','dragstart'].forEach(ev =>
          boardEl.addEventListener(ev, markDown, { passive: true, capture: true }));
        ['pointerup','mouseup','touchend','touchcancel','dragend','drop'].forEach(ev =>
          boardEl.addEventListener(ev, markUp,   { passive: true, capture: true }));

        this._state.snapshot = readSnapshot(boardEl);

        const obs = new MutationObserver(()=>{
          if (this._state.rafId) return;
          this._state.rafId = requestAnimationFrame(()=>{
            this._state.rafId = 0;
            const prev = this._state.snapshot;
            const next = readSnapshot(boardEl);

            let changed = false;
            for (const k in next){ if (next[k] !== prev[k]) { changed = true; break; } }
            if (!changed){ this._state.snapshot = next; return; }

            const moved = detectMovedColor(prev, next); // 'w'|'b'|null
            this._state.snapshot = next;
            if (!moved) return;

            const sincePtr = performance.now() - this._state.lastPointerTs;

            // Inside pointer-tail window -> likely user's action
            if (sincePtr <= CONFIG.pointerTailMs){
              if (!this._state.humanColor) this._state.humanColor = moved;

              // But if the color that changed is NOT the human color (engine reply inside tail),
              // schedule a delayed pulse to fire after the tail window expires.
              if (this._state.humanColor && moved !== this._state.humanColor){
                const delay = Math.max(0, CONFIG.pointerTailMs - sincePtr + 20);
                clearTimeout(this._state.delayedTimer);
                this._state.delayedTimer = setTimeout(()=> this.flash(), delay);
              }
              return;
            }

            // Outside tail: opponent move if color != human
            if (!this._state.humanColor || moved !== this._state.humanColor){
              this.flash();
            }
          });
        });
        obs.observe(boardEl, {
          subtree:true,
          childList:true,
          characterData:true,
          attributes:true,
          attributeFilter:['class','data-piece'] // watching class & data-piece changes
        });

        this.host = host;
        this.board = boardEl;
        this.ready = true;
      }catch(e){
        console.error('MoveFlash.attachTo failed:', e);
      }
    },

    flash(opts){
      opts = opts || {};
      const dur = typeof opts.duration === 'number' ? opts.duration : this._state.duration;
      const color = opts.color || this._state.color;
      const host = this.host;
      if (!host) return;
      host.classList.remove('mf-pulse');
      host.style.setProperty('--mf-color', color);
      host.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      host.offsetWidth;
      host.style.animation = `mfPulse ${dur}ms ease-out`;
      host.classList.add('mf-pulse');
    },

    setColor(color){
      this._state.color = color || CONFIG.color;
    },

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