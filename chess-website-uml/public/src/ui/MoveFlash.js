// chess-website-uml/public/src/ui/MoveFlash.js
// BORDER-ONLY glow via CSS box-shadow on `.board-wrap`.
// Pulses **only on opponent moves**, including instant **book** replies, and
// suppresses pulses on **page load** or **New Game** resets.
//
// Core rules
// • Tail starts on release only: pointerup / dragend / drop (not on pointerdown).
// • Mutations during active drag are ignored.
// • We diff actual square occupancy (.sq[data-square]) to detect real moves.
// • We count "additions since tail start": if >=2 inside tail → your move + instant book reply → pulse at tail end.
// • If exactly 1 addition inside tail → arm awaitingOpponent → pulse on next addition after tail.
// • Large-batch changes (>6 squares changed) are treated as resets and never pulse.
//
// API: window.MoveFlash.{attachTo, flash({duration,color}), setColor(color), test()}; alias window.moveflash.
//
(function(){
  'use strict';

  const CONFIG = {
    duration: 1500,
    color: 'rgb(160,210,255)',
    peak: 0.55,
    tailMs: 420,          // length of pointer tail window
    bulkThreshold: 6      // >= changed squares → treat as reset (no pulse)
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

  // ---------- occupancy snapshot & diff ----------
  function colorOfSquare(el){
    // prefer data-piece like "wP"/"bq"
    const dp = el.getAttribute('data-piece');
    if (dp && /^[wb]/i.test(dp)) return dp[0].toLowerCase();

    // common class patterns
    for (const cls of el.classList){
      if (cls === 'pw' || cls === 'white' || cls === 'w') return 'w';
      if (cls === 'pb' || cls === 'black' || cls === 'b') return 'b';
    }

    // nested piece nodes
    const pieceChild = el.querySelector('.piece.white, .white, .pw, .piece.black, .black, .pb');
    if (pieceChild){
      if (pieceChild.classList.contains('white') || pieceChild.classList.contains('pw')) return 'w';
      if (pieceChild.classList.contains('black') || pieceChild.classList.contains('pb')) return 'b';
    }

    // text glyphs/letters fallback
    const txt = el.textContent || '';
    const m = txt.match(/[prnbqkPRNBQK♙♘♗♖♕♔♟♞♝♜♛♚]/);
    if (m){
      const ch = m[0];
      // Assume uppercase/glyph = white, lowercase = black
      if (/[PRNBQK♙♘♗♖♕♔]/.test(ch)) return 'w';
      if (/[prnbqk♟♞♝♜♛♚]/.test(ch)) return 'b';
    }

    return null;
  }

  function takeSnapshot(boardEl){
    const map = Object.create(null);
    const nodes = boardEl.querySelectorAll('.sq[data-square]');
    nodes.forEach(el => {
      const sq = el.getAttribute('data-square');
      map[sq] = colorOfSquare(el);
    });
    return map;
  }

  function diffCounts(prev, next){
    let changed = 0, additions = 0;
    for (const sq in next){
      const a = prev[sq] || null;
      const b = next[sq] || null;
      if (a !== b){
        changed++;
        if (b) additions++;
      }
    }
    return { changed, additions };
  }

  // ---------- core ----------
  const API = {
    ready: false,
    host: null,
    board: null,
    _state: {
      color: CONFIG.color,
      duration: CONFIG.duration,

      // drag / tail FSM
      inDrag: false,
      tailActive: false,
      tailTimer: 0,
      tailStartSnap: null,   // snapshot at start of tail
      lastSnap: null,        // last processed snapshot (for general diffs)
      rafId: 0,
      awaitingOpponent: false
    },

    attachTo(boardEl){
      try{
        injectStyle();
        const host = findHost(boardEl);
        host.classList.add('mf-host');

        // initial snapshot (prevents boot pulse)
        this._state.lastSnap = takeSnapshot(boardEl);

        const startTail = ()=>{
          clearTimeout(this._state.tailTimer);
          this._state.tailActive = true;
          this._state.tailStartSnap = takeSnapshot(boardEl); // baseline for counting additions inside tail

          this._state.tailTimer = setTimeout(()=>{
            // End of tail window
            this._state.tailActive = false;

            // Compare current board vs tail start to count total additions inside tail
            const nowSnap = takeSnapshot(boardEl);
            const { changed, additions } = diffCounts(this._state.tailStartSnap, nowSnap);

            if (changed >= CONFIG.bulkThreshold){
              // Reset/init event inside tail → do nothing
              this._state.awaitingOpponent = false;
            } else if (additions >= 2){
              // Your move + instant book reply happened within tail → flash once now
              this.flash();
              this._state.awaitingOpponent = false;
            } else if (additions === 1){
              // Only your move inside tail → wait for opponent outside tail
              this._state.awaitingOpponent = true;
            } else {
              this._state.awaitingOpponent = false;
            }

            // Update baseline
            this._state.lastSnap = nowSnap;
            this._state.tailStartSnap = null;
          }, CONFIG.tailMs);
        };

        // drag boundaries
        const onDragStart = ()=>{ this._state.inDrag = true; };
        const onDragEnd   = ()=>{ this._state.inDrag = false; startTail(); };

        // click-to-move: start tail on release
        const onUp = startTail;

        boardEl.addEventListener('dragstart', onDragStart, { capture: true });
        boardEl.addEventListener('dragend',   onDragEnd,   { capture: true });
        boardEl.addEventListener('drop',      onDragEnd,   { capture: true });
        ['pointerup','mouseup','touchend','touchcancel'].forEach(ev =>
          boardEl.addEventListener(ev, onUp, { passive: true, capture: true }));

        // observe occupancy changes
        const obs = new MutationObserver(()=>{
          if (this._state.rafId) return;
          this._state.rafId = requestAnimationFrame(()=>{
            this._state.rafId = 0;

            if (this._state.inDrag) return; // ignore drag churn

            const prev = this._state.lastSnap || takeSnapshot(boardEl);
            const next = takeSnapshot(boardEl);
            const { changed, additions } = diffCounts(prev, next);

            // Update baseline immediately
            this._state.lastSnap = next;

            if (changed === 0) return;

            // Suppress resets / New Game / initial layout
            if (changed >= CONFIG.bulkThreshold){
              this._state.awaitingOpponent = false;
              return;
            }

            if (this._state.tailActive){
              // Inside tail: do nothing now; we'll decide at tail end using tailStartSnap
              return;
            }

            // Outside tail: opponent moved (either normal think or book just after tail)
            if (this._state.awaitingOpponent){
              this.flash();
              this._state.awaitingOpponent = false;
            } else {
              // No tail and not awaiting -> engine-only changes (e.g., auto-play) → pulse
              this.flash();
            }
          });
        });
        obs.observe(boardEl, {
          subtree:true,
          childList:true,
          characterData:true,
          attributes:true,
          attributeFilter:['class','data-piece','style']
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

    setColor(color){ this._state.color = color || CONFIG.color; },

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