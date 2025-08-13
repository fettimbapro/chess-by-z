import { Game } from '../core/Game.js';
import { Clock } from '../core/Clock.js';
import { BoardUI } from '../ui/BoardUI.js';
import { WorkerEngine } from '../engine/WorkerEngine.js';
import { PuzzleService } from '../puzzles/PuzzleService.js';
import { PuzzleUI } from '../puzzles/PuzzleUI.js';
import { ClockPanel } from '../ui/ClockPanel.js';
import { detectOpening } from '../engine/Openings.js';

const qs = (s) => document.querySelector(s);

class App {
  constructor() {
    // DOM
    this.boardEl = qs('#board');
    this.arrowSvg = qs('#arrowSvg');
    this.evalbar = qs('#evalbar');
    this.evalWhite = qs('#evalWhite');
    this.evalBlack = qs('#evalBlack');
    this.promo = qs('#promo');

    this.pvBox = qs('#pvBox');
    this.engineStatus = qs('#engineStatus');

    // Controls
    this.modeSel = qs('#mode');
    this.sideSel = qs('#side');
    this.flipBtn = qs('#flip');
    this.newGameBtn = qs('#newGame');

    // Engine knobs
    this.elo = qs('#elo'); this.eloVal = qs('#eloVal');
    this.depth = qs('#depth'); this.depthVal = qs('#depthVal');
    this.multipv = qs('#multipv'); this.multipvVal = qs('#multipvVal');
    this.think = qs('#think'); this.thinkVal = qs('#thinkVal');

    // Clock UI elements
    const clockEls = {
      white: qs('#clockWhite'),
      black: qs('#clockBlack'),
      timeMin: qs('#timeMin'),
      incSec: qs('#incSec'),
      start: qs('#startClocks'),
      pause: qs('#pauseClocks'),
      reset: qs('#resetClocks'),
      turnSupplier: () => this.game.turn()
    };

    // Core
    this.game = new Game();
    this.clock = new Clock();
    this.engine = new WorkerEngine();

    // Clock UI
    this.clockPanel = new ClockPanel({ clock: this.clock, els: clockEls });
    this.clock.onFlag = (side) => {
      this.engine.stop?.();
      this.engineStatus.textContent = (side === 'w') ? 'White flagged.' : 'Black flagged.';
    };
    this.clockPanel.render();

    // Board UI
    this.ui = new BoardUI({
      boardEl: this.boardEl,
      arrowSvg: this.arrowSvg,
      promoEl: this.promo,
      evalbar: { root: this.evalbar, white: this.evalWhite, black: this.evalBlack },
      onUserMove: this.onUserMove.bind(this),
      getPieceAt: (sq) => this.game.get(sq),
      getLegalTargets: (sq) => this.game.legalMovesFrom(sq)
    });
    this.ui.setOrientation(this.sideSel.value);

    // Puzzles
    this.puzzleService = new PuzzleService();
    this.puzzles = new PuzzleUI({
      game: this.game, ui: this.ui, service: this.puzzleService,
      dom: {
        panel: qs('#puzzlePanel'), fetchDailyBtn: qs('#fetchDaily'),
        loadByIdBtn: qs('#loadById'), puzzleIdInput: qs('#puzzleIdInput'),
        importCsvBtn: qs('#importCsvBtn'), importCsvFile: qs('#importCsvFile'),
        packInfo: qs('#packInfo'), packUrlInput: qs('#packUrl'),
        downloadPackBtn: qs('#downloadPackBtn'), demoPackBtn: qs('#demoPackBtn'),
        sample500Btn: qs('#sample500Btn'), themeFilter: qs('#themeFilter'),
        minRating: qs('#minRating'), maxRating: qs('#maxRating'),
        randomFromPackBtn: qs('#randomFromPack'), nextPuzzleBtn: qs('#nextPuzzle'),
        hintBtn: qs('#puzzleHint'), puzzleInfo: qs('#puzzleInfo'), puzzleStatus: qs('#puzzleStatus')
      },
      onStateChanged: () => { this.syncBoard(); this.refreshAll(); }
    });

    // Floating info popover
    this.installGameInfoPopover();

    // --- REVIEW MODE state ---
    this.inReview = false;      // true when viewing a past position
    this.reviewPly = 0;         // which half-move (ply) we’re viewing
    this.reviewFen = null;      // cached FEN of the viewed position

    // Celebration guard (fireworks once per final ply)
    this.lastCelebrationPly = -1;

    // Init
    this.bindControls();
    this.bindReviewHotkeys();
    this.bindBoardClickExitReview();

    this.syncBoard();
    this.refreshAll();
    this.updateEloDisplay?.();

    // Do NOT start clocks yet; only after the human makes their first move.
    if (this.modeSel.value === 'play') {
      this.maybeEngineMove();
    }
  }

  bindControls(){
    const link = (el, label, after) => {
      const f = () => { label.textContent = el.value; after && after(); };
      el.addEventListener('input', f); f();
    };
    link(this.elo, this.eloVal, () => this.updateEloDisplay?.());
    link(this.depth, this.depthVal, () => this.updateEloDisplay?.());
    link(this.multipv, this.multipvVal, () => this.updateEloDisplay?.());
    link(this.think, this.thinkVal, () => this.updateEloDisplay?.());

    this.modeSel.addEventListener('change', () => {
      const m = this.modeSel.value;
      this.puzzles.show(m === 'puzzle');
      if (m === 'play') { this.maybeEngineMove(); }
      else this.clock.pause();
      this.refreshAll();
    });

    this.sideSel.addEventListener('change', () => {
      this.ui.setOrientation(this.sideSel.value);
      this.refreshAll();
      this.maybeEngineMove();
    });

    this.flipBtn.addEventListener('click', () => this.ui.flip());

    this.newGameBtn.addEventListener('click', () => {
      this.exitReview(); // ensure back to live
      this.lastCelebrationPly = -1;
      this.game.reset();
      this.ui.stopCelebration?.();
      // Clear user drawings
      this.ui.clearUserArrows?.();
      this.ui.clearUserCircles?.();
      this.syncBoard(); this.refreshAll();

      this.clockPanel.applyInputs?.();
      this.clockPanel.render();

      if (this.modeSel.value === 'analysis') this.requestAnalysis();
      else if (this.modeSel.value === 'play') { this.maybeEngineMove(); }
      else if (this.modeSel.value === 'puzzle') { this.puzzles.resetProgress(); this.clockPanel.pause(); }
    });

    qs('#analyzeBtn').addEventListener('click', () => this.requestAnalysis());
    qs('#hintBtn').addEventListener('click', () => this.requestHint());
    qs('#stopBtn').addEventListener('click', () => this.engine.stop());
    // === Drawing hotkeys ===
    window.addEventListener('keydown', (e) => {
      // Ignore when typing
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/).test(t.tagName)) return;

      // Clear drawings: X
      if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey){
        e.preventDefault();
        this.ui.clearUserArrows?.(); this.ui.clearUserCircles?.();
      }
      // Export drawings: Cmd/Ctrl+E
      if ((e.key === 'e' || e.key === 'E') && (e.metaKey || e.ctrlKey)){
        e.preventDefault();
        try {
          const data = this.ui.getUserDrawings?.() || {arrows:[],circles:[]};
          navigator.clipboard?.writeText(JSON.stringify(data,null,2));
          this.engineStatus.textContent = 'Copied drawings JSON';
        } catch {}
      }
      // Import drawings: Cmd/Ctrl+I
      if ((e.key === 'i' || e.key === 'I') && (e.metaKey || e.ctrlKey)){
        e.preventDefault();
        const txt = prompt('Paste drawings JSON ({arrows:[{uci,color}], circles:[{sq,color}]})');
        if (!txt) return;
        try { this.ui.setUserDrawings?.(JSON.parse(txt)); }
        catch { this.engineStatus.textContent = 'Invalid drawings JSON'; }
      }
    });

  }

  // === Review hotkeys & click-to-exit ===
  bindReviewHotkeys(){
    window.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/).test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const key = e.key;
      const histLen = this.getSanHistory().length;

      if (key === 'ArrowLeft'){
        e.preventDefault();
        if (!this.inReview){
          if (histLen === 0) return;          // nothing to review
          this.enterReviewAt(histLen - 1);    // go to last completed ply
        } else {
          this.setReviewPly(Math.max(0, this.reviewPly - 1));
        }
      }
      else if (key === 'ArrowRight'){
        e.preventDefault();
        if (!this.inReview) return; // already live; nothing forward
        const next = Math.min(histLen, this.reviewPly + 1);
        if (next === histLen) this.exitReview(); else this.setReviewPly(next);
      }
    });
  }

  bindBoardClickExitReview(){
    this.boardEl?.addEventListener('click', () => {
      if (this.inReview) this.exitReview();
    });
  }

  // === Review helpers ===
  enterReviewAt(ply){
    this.inReview = true;
    this.setReviewPly(ply);
    // Disable interaction on the board (no moves while reviewing)
    this.ui.onUserMove = () => false;
    this.ui.getPieceAt = () => null;         // prevent drag start
    this.ui.getLegalTargets = () => [];      // no dots/highlights for moves
  }

  setReviewPly(ply){
    const hist = this.getSanHistory();
    const clamped = Math.max(0, Math.min(hist.length, ply|0));
    this.reviewPly = clamped;
    this.reviewFen = this.buildFenFromSan(hist.slice(0, clamped));
    this.syncBoard();     // will display review FEN
    this.refreshAll();    // updates popover with sliced moves
  }

  exitReview(){
    if (!this.inReview) return;
    this.inReview = false;
    this.reviewFen = null;

    // Restore live providers (board interaction enabled again)
    this.ui.onUserMove = this.onUserMove.bind(this);
    this.ui.getPieceAt = (sq) => this.game.get(sq);
    this.ui.getLegalTargets = (sq) => this.game.legalMovesFrom(sq);

    this.syncBoard();   // back to live fen
    this.refreshAll();
    this.maybeEngineMove(); // if engine to move, resume
  }

  getActiveFen(){
    return this.inReview && this.reviewFen ? this.reviewFen : this.game.fen();
  }

  buildFenFromSan(sanList){
    // Rebuild a position from SANs using a temporary Game instance
    const g = new Game();
    for (const san of sanList){ g.moveSan(san); }
    return g.fen();
  }

  onUserMove({ from, to, promotion }) {
    if (this.inReview) return false; // safety net
    const mv = this.game.move({ from, to, promotion: promotion || 'q' });
    if (!mv) return false;

    if (this.modeSel.value === 'play') { this.clock.onMoveApplied(); this.clockPanel.startIfNotRunning(); }
    if (this.modeSel.value === 'puzzle') {
      const ok = this.puzzles.handleUserMove(mv);
      this.syncBoard(); this.refreshAll();
      this.maybeCelebrate(); // celebration for puzzle mates as well
      return ok;
    }

    this.syncBoard(); this.refreshAll();
    this.maybeCelebrate();
    if (this.modeSel.value === 'analysis') this.requestAnalysis();
    else if (this.modeSel.value === 'play') this.maybeEngineMove();
    return true;
  }

  maybeEngineMove(){
    if (this.modeSel.value !== 'play') return;
    if (this.inReview) return; // don't move engine while browsing history
    const humanIs = (this.sideSel.value === 'white') ? 'w' : 'b';
    if (this.game.turn() !== humanIs) this.requestBestMove();
  }

  // === Opening book: ask boot.js for a SAN move before calling the engine
  askBookMove(){
    return new Promise((resolve) => {
      const onMove = (ev) => resolve(ev?.detail?.san || null);
      window.addEventListener('book:move', onMove, { once: true });
      const hist = this.getSanHistory();
      window.dispatchEvent(new CustomEvent('book:request', {
        detail: { sanHistory: hist.join(' '), ply: hist.length, mode: this.modeSel.value }
      }));
      setTimeout(() => resolve(null), 25); // tolerate missing listener
    });
  }

  async requestBestMove(){
    try{
      if (this.inReview) return; // safety
      this.engineStatus.textContent = 'Engine thinking...';

      // 1) Try the opening book first
      const san = await this.askBookMove();
      if (san) {
        const mv = this.game.moveSan(san);
        if (mv) {
          this.clock.onMoveApplied?.();
          const last = this.game.historyVerbose?.().slice(-1)[0] || mv;
          if (last?.from && last?.to) this.ui.drawArrowUci(last.from + last.to + (last.promotion||''), true);
          this.syncBoard(); this.refreshAll();
          this.maybeCelebrate();
          this.engineStatus.textContent = 'Book move';
          return;
        }
      }

      // 2) Fall back to the engine
      const uci = await this.engine.play(this.game.fen(), {
        elo: parseInt(this.elo.value,10),
        depthCap: parseInt(this.depth.value,10),
        timeMs: parseInt(this.think.value,10)
      });
      if (uci) {
        this.game.moveUci(uci);
        if (this.modeSel.value === 'play') this.clock.onMoveApplied();
        this.syncBoard(); this.refreshAll();
        this.ui.drawArrowUci(uci, true);
        this.maybeCelebrate();
      }
      this.engineStatus.textContent = 'Engine: move played';
    }catch(e){
      this.engineStatus.textContent = 'Engine error: ' + e.message;
      console.error(e);
    }
  }

  async requestAnalysis(){
    try{
      if (this.inReview) return; // keep analysis tied to current position only
      this.engineStatus.textContent = 'Analyzing...';
      const lines = await this.engine.analyze(this.game.fen(), {
        depth: parseInt(this.depth.value,10),
        multipv: parseInt(this.multipv.value,10),
        timeMs: parseInt(this.think.value,10)
      });
      this.ui.clearArrow?.();
      (lines||[]).forEach((l,i)=> { if (l.firstUci) this.ui.drawArrowUci(l.firstUci, i===0); });
      if (lines && lines[0]) this.updateEvalFromCp(lines[0].scoreCp);
      this.engineStatus.textContent = 'Engine: ready';

      this.pvBox.innerHTML = (lines || []).map((it, i) =>
        `<div>PV${i + 1}: <b>${(it.scoreCp / 100).toFixed(2)}</b> — <span class="muted">${(it.san || []).join(' ')}</span></div>`
      ).join('');
    }catch(e){
      this.engineStatus.textContent = 'Engine error: ' + e.message;
      console.error(e);
    }
  }

  async requestHint(){
    try{
      if (this.inReview) return;
      this.engineStatus.textContent = 'Hint...';
      const lines = await this.engine.analyze(this.game.fen(), {
        depth: Math.max(2, parseInt(this.depth.value,10)),
        multipv: 1,
        timeMs: parseInt(this.think.value,10)
      });
      if (lines && lines[0]?.firstUci) this.ui.drawArrowUci(lines[0].firstUci);
      if (lines && lines[0]) this.updateEvalFromCp(lines[0].scoreCp);
      this.engineStatus.textContent = 'Engine: ready';
    }catch(e){
      this.engineStatus.textContent = 'Engine error: ' + e.message;
      console.error(e);
    }
  }

  updateEvalFromCp(cp){
    const clamped = Math.max(-1000, Math.min(1000, cp|0));
    const pct = 50 + (clamped/20);
    this.evalbar.style.display = 'block';
    this.evalWhite.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    this.evalBlack.style.height = `${Math.max(0, Math.min(100, 100-pct))}%`;
  }

  syncBoard(){
    this.ui.setOrientation(this.sideSel.value);
    this.ui.setFen(this.getActiveFen());
  }

  refreshAll(){
    this.updateStatusMinimal();
    this.updateGameInfo();   // info popover content
    this.updateEloDisplay?.();
  }

  updateStatusMinimal(){
    // Minimal status; detailed info is in popover.
  }

  // === HONEST UI ELO (display-only estimate) ===
  updateEloDisplay(){
    if (!this.elo || !this.eloVal) return;

    const engineElo = parseInt(this.elo.value, 10) || 0;
    const depthCap = parseInt(this.depth?.value || '0', 10) || 0;
    const thinkMs  = parseInt(this.think?.value || '0', 10) || 0;

    const est = estimateUiElo(engineElo, depthCap, thinkMs);

    this.eloVal.textContent = `≈ ${est}`;
    this.eloVal.title = `Engine param: ${engineElo}`;

    const autoSummary = qs('#autoSummary');
    if (autoSummary) autoSummary.textContent = `Estimated strength: ≈ ${est}`;
  }

  // === Game Info Popover ===
  installGameInfoPopover(){
    const wrap = document.querySelector('.board-wrap');
    if (!wrap) return;

    // Trigger
    this.infoBtn = document.createElement('button');
    this.infoBtn.type = 'button';
    this.infoBtn.className = 'game-info-trigger';
    this.infoBtn.setAttribute('aria-label','Game info');
    this.infoBtn.textContent = 'ⓘ';

    // Popover
    this.infoPop = document.createElement('div');
    this.infoPop.className = 'game-info-pop';
    this.infoPop.innerHTML = '<div class="tip-row"><span class="tip-label">Loading…</span></div>';

    wrap.appendChild(this.infoBtn);
    wrap.appendChild(this.infoPop);

    // Behavior
    this.infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.infoPop.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!this.infoPop.classList.contains('open')) return;
      if (e.target === this.infoBtn) return;
      if (this.infoPop.contains(e.target)) return;
      this.infoPop.classList.remove('open');
    });
  }

  updateGameInfo(){
    if (!this.infoPop) return;

    // 1) Turn
    let turnSide;
    if (this.inReview){
      turnSide = (this.reviewPly % 2 === 0) ? 'White' : 'Black';
    } else {
      turnSide = (this.game.turn() === 'w') ? 'White' : 'Black';
    }

    // 2) Opening (best prefix match)
    const sanHistFull = this.getSanHistory();
    const sanHist = this.inReview ? sanHistFull.slice(0, this.reviewPly) : sanHistFull;
    const openingName = detectOpening(sanHist) || '—';

    // 3) Moves (numbered, compact)
    const movesText = this.formatMoves(sanHist) || '—';

    this.infoPop.innerHTML = `
      <div class="tip-row">
        <span class="tip-label">Turn</span>
        <span class="tip-value">${turnSide}${this.inReview ? ' (review)' : ''}</span>
      </div>
      <div class="tip-row">
        <span class="tip-label">Opening</span>
        <span class="tip-value">${openingName}</span>
      </div>
      <div class="tip-row">
        <span class="tip-label">Moves</span>
        <div class="tip-moves">${movesText}</div>
      </div>
    `;
  }

  getSanHistory(){
    if (typeof this.game.history === 'function') {
      const h = this.game.history();
      if (Array.isArray(h)) return h;
    }
    if (this.game.ch && typeof this.game.ch.history === 'function') {
      const h = this.game.ch.history();
      if (Array.isArray(h)) return h;
    }
    const pgn = (typeof this.game.pgn === 'function') ? String(this.game.pgn() || '') : '';
    const tail = pgn.split('\n\n').pop() || '';
    return tail.trim().split(/\s+/).filter(x => !/^\d+\.(\.\.)?$/.test(x) && x !== '*');
  }

  formatMoves(sanList){
    if (!sanList || !sanList.length) return '';
    let out = [];
    let num = 1;
    for (let i = 0; i < sanList.length; i += 2) {
      const white = sanList[i] || '';
      const black = sanList[i+1] || '';
      if (black) out.push(`${num}. ${white} ${black}`);
      else out.push(`${num}. ${white}`);
      num++;
    }
    return out.join(' ');
  }

  // === Mate detection & celebration ===
  isMateNow(){
    // 1) Library-agnostic: last SAN ends with '#'
    const lastSan = this.getSanHistory().slice(-1)[0] || '';
    if (/#$/.test(lastSan)) return true;

    // 2) Wrapper APIs (various naming schemes)
    if (typeof this.game.isCheckmate === 'function' && this.game.isCheckmate()) return true;
    if (typeof this.game.inCheckmate === 'function' && this.game.inCheckmate()) return true;

    // 3) Underlying chess.js (if exposed)
    if (this.game.ch) {
      const ch = this.game.ch;
      if (typeof ch.in_checkmate === 'function' && ch.in_checkmate()) return true;
      if (typeof ch.isCheckmate === 'function' && ch.isCheckmate()) return true;
    }

    // 4) Fallback: game over but not draw (not perfect, but harmless)
    if (typeof this.game.isGameOver === 'function' && typeof this.game.isDraw === 'function'){
      if (this.game.isGameOver() && !this.game.isDraw()) return true;
    }
    if (this.game.ch){
      const ch = this.game.ch;
      if (typeof ch.game_over === 'function' && typeof ch.in_draw === 'function'){
        if (ch.game_over() && !ch.in_draw()) return true;
      }
    }
    return false;
  }

  maybeCelebrate(){
    if (this.inReview) return; // never in review
    const ply = this.getSanHistory().length;
    if (this.isMateNow() && this.lastCelebrationPly !== ply){
      this.lastCelebrationPly = ply;
      this.ui.celebrate?.();
    }
  }
}

// Conservative UI-only Elo estimate
function estimateUiElo(engineElo, depthCap, thinkMs){
  let base;
  if (engineElo <= 1000) base = 700;
  else if (engineElo <= 1300) base = 900;
  else if (engineElo <= 1600) base = 1100;
  else if (engineElo <= 1900) base = 1200;
  else base = 1200;

  const depthAdj = Math.max(-50, Math.min(50, (depthCap - 8) * 6)); // ±50
  const timeAdj  = Math.max(0, Math.min(40, Math.log10(Math.max(100, thinkMs)) * 10 - 20)); // ~0..40

  const est = Math.round(Math.max(600, Math.min(1300, base + depthAdj + timeAdj)));
  return est;
}

window.addEventListener('DOMContentLoaded', () => new App());
