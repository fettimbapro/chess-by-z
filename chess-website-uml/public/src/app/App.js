import { Game } from "../core/Game.js";
import { Clock } from "../core/Clock.js";
import { BoardUI } from "../ui/BoardUI.js";
import { WorkerEngine } from "../engine/WorkerEngine.js";
import { PuzzleService } from "../puzzles/PuzzleService.js";
import { PuzzleUI } from "../puzzles/PuzzleUI.js";
import { ClockPanel } from "../ui/ClockPanel.js";
import { detectOpening } from "../engine/Openings.js";
import { Sounds } from "../util/Sounds.js";

const qs = (s) => document.querySelector(s);

export class App {
  constructor() {
    window.app = this;

    // DOM
    this.boardEl = qs("#board");
    this.boardArea = qs(".board-area");
    this.arrowSvg = qs("#arrowSvg");
    this.evalbar = qs("#evalbar");
    this.evalWhite = qs("#evalWhite");
    this.evalBlack = qs("#evalBlack");
    this.promo = qs("#promo");

    this.pvBox = qs("#pvBox");
    this.engineStatus = qs("#engineStatus");
    this.infoTurn = qs("#infoTurn");
    this.infoOpening = qs("#infoOpening");
    this.infoMoves = qs("#infoMoves");

    // Controls
    this.modeSel = qs("#mode");
    this.modeBtns = Array.from(
      document.querySelectorAll("#modeButtons [data-mode]"),
    );
    this.sideSel = qs("#side");
    this.switchBtn = qs("#switchSide");
    this.confirmRestart = false;
    this.confirmTimeout = null;
    this.pgnText = qs("#pgnText");
    this.fenText = qs("#fenText");

    // Engine knobs
    this.elo = qs("#elo");
    this.eloVal = qs("#eloVal");
    this.depth = qs("#depth");
    this.depthVal = qs("#depthVal");
    this.multipv = qs("#multipv");
    this.multipvVal = qs("#multipvVal");

    // Clock UI elements
    const clockEls = {
      white: qs("#clockWhite"),
      black: qs("#clockBlack"),
      timeMin: qs("#timeMin"),
      incSec: qs("#incSec"),
      turnSupplier: () => this.game.turn(),
    };

    // Core
    this.game = new Game();
    this.clock = new Clock();
    // Allow switching between classic and strong engine via ?engine=strong
    const params = new URLSearchParams(window.location.search);
    const engineVariant =
      params.get("engine") === "strong" ? "strong" : "classic";
    this.engine = new WorkerEngine({ variant: engineVariant });
    this.sounds = new Sounds();

    // Clock UI
    this.clockPanel = new ClockPanel({ clock: this.clock, els: clockEls });
    this.clock.onFlag = (side) => {
      this.engine.stop?.();
      this.gameOver = true;
      this.engineStatus.textContent =
        side === "w" ? "White flagged." : "Black flagged.";
    };
    this.clockPanel.render();

    // Board UI
    this.ui = new BoardUI({
      boardEl: this.boardEl,
      arrowSvg: this.arrowSvg,
      promoEl: this.promo,
      evalbar: {
        root: this.evalbar,
        white: this.evalWhite,
        black: this.evalBlack,
      },
      onUserMove: this.onUserMove.bind(this),
      getPieceAt: this.getPieceAt.bind(this),
      getLegalTargets: this.getLegalTargets.bind(this),
      cancelPreMove: this.cancelPreMove.bind(this),
    });
    this.applyOrientation();
    this.updateSwitchButtonText();

    // Puzzles
    this.puzzleService = new PuzzleService();
    this.puzzles = new PuzzleUI({
      game: this.game,
      ui: this.ui,
      service: this.puzzleService,
      dom: {
        panelTop: qs("#puzzleTop"),
        panelBottom: qs("#puzzleBottom"),
        clockBlack: qs("#clockBlack"),
        clockWhite: qs("#clockWhite"),
        fetchDailyBtn: qs("#fetchDaily"),
        startPuzzleBtn: qs("#startPuzzle"),
        nextPuzzleBtn: qs("#nextPuzzle"),
        hintBtn: qs("#puzzleHint"),
        openingSel: qs("#openingFilter"),
        difficultyRange: qs("#difficultyRange"),
        difficultyLabel: qs("#difficultyLabel"),
        puzzleInfo: qs("#puzzleInfo"),
        puzzleStatus: qs("#puzzleStatus"),
      },
      onStateChanged: () => {
        this.syncBoard();
        this.refreshAll();
      },
      onMove: (mv) => this.playMoveSound(mv),
      onPuzzleLoad: (turn) => {
        this.sideSel.value = turn === "w" ? "white" : "black";
        this.updateSwitchButtonText();
      },
    });

    // --- REVIEW MODE state ---
    this.inReview = false; // true when viewing a past position
    this.reviewPly = 0; // which half-move (ply) we’re viewing
    this.reviewFen = null; // cached FEN of the viewed position

    // Celebration guard (fireworks once per final ply)
    this.lastCelebrationPly = -1;
    this.gameOver = false;
    this.preMove = null;

    // Init
    this.bindControls();
    this.bindReviewHotkeys();

    // --- Drawing hotkeys ---
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      // don't hijack when typing
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;

      // Clear drawings: X
      if (
        (e.key === "x" || e.key === "X") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        this.ui.clearUserArrows?.();
        this.ui.clearUserCircles?.();
      }

      // Export drawings JSON: ⌘/Ctrl+E
      if ((e.key === "e" || e.key === "E") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const data = this.ui.getUserDrawings?.() || { arrows: [], circles: [] };
        try {
          navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
          this.engineStatus.textContent = "Copied drawings JSON";
        } catch {}
      }

      // Import drawings JSON: ⌘/Ctrl+I
      if ((e.key === "i" || e.key === "I") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const txt = prompt(
          "Paste drawings JSON ({arrows:[{uci,color}], circles:[{sq,color}]})",
        );
        if (!txt) return;
        try {
          this.ui.setUserDrawings?.(JSON.parse(txt));
        } catch {
          this.engineStatus.textContent = "Invalid drawings JSON";
        }
      }
    });
    this.bindBoardClickExitReview();

    this.syncBoard();
    this.refreshAll();
    this.updateModeButtonStyles();

    // Do NOT start clocks yet; only after the human makes their first move.
    if (this.modeSel.value === "play") {
      this.maybeEngineMove();
    }
  }

  bindControls() {
    const link = (el, label, after) => {
      const f = () => {
        label.textContent = el.value;
        after && after();
      };
      el.addEventListener("input", f);
      f();
    };
    link(this.elo, this.eloVal);
    link(this.depth, this.depthVal);
    link(this.multipv, this.multipvVal);

    this.modeBtns.forEach((btn) =>
      btn.addEventListener("click", () => this.setMode(btn.dataset.mode)),
    );

    this.modeSel.addEventListener("change", async () => {
      const m = this.modeSel.value;
      this.puzzles.show(m === "puzzle");
      if (m === "play") {
        this.maybeEngineMove();
      } else this.clock.pause();
      if (m === "puzzle") {
        this.puzzles.resetProgress();
        this.clockPanel.pause();
        try {
          const p = await this.puzzleService.fetchDaily();
          await this.puzzles.loadConvertedPuzzle(p);
        } catch (e) {
          this.engineStatus.textContent = "Daily puzzle fetch failed";
        }
      }
      this.refreshAll();
      this.applyOrientation();
      this.updateModeButtonStyles();
    });

    this.sideSel.addEventListener("change", () => {
      this.applyOrientation();
      this.refreshAll();
      this.maybeEngineMove();
      this.updateSwitchButtonText();
    });

    this.switchBtn.addEventListener("click", () => {
      if (this.confirmRestart) {
        clearTimeout(this.confirmTimeout);
        this.confirmRestart = false;
        this.switchBtn.classList.remove("confirm");
        this.sideSel.value = this.sideSel.value === "white" ? "black" : "white";
        this.applyOrientation();
        this.startNewGame();
        this.updateSwitchButtonText();
      } else {
        this.confirmRestart = true;
        this.switchBtn.textContent = "Restart?";
        this.switchBtn.classList.add("confirm");
        this.confirmTimeout = setTimeout(() => {
          this.confirmRestart = false;
          this.switchBtn.classList.remove("confirm");
          this.updateSwitchButtonText();
        }, 2000);
      }
    });

    // PGN / FEN helpers
    qs("#copyPgn").addEventListener("click", () => {
      const pgn = this.game.pgn();
      this.pgnText.value = pgn;
      try {
        navigator.clipboard?.writeText(pgn);
        this.engineStatus.textContent = "PGN copied";
      } catch {}
    });
    qs("#loadPgn").addEventListener("click", () => {
      const txt = this.pgnText.value.trim();
      if (!txt) return;
      if (this.game.loadPgn(txt)) {
        this.exitReview();
        this.syncBoard();
        this.refreshAll();
        this.engineStatus.textContent = "PGN loaded";
      } else {
        this.engineStatus.textContent = "Invalid PGN";
      }
    });
    qs("#exportFen").addEventListener("click", () => {
      const fen = this.game.fen();
      this.fenText.value = fen;
      try {
        navigator.clipboard?.writeText(fen);
        this.engineStatus.textContent = "FEN copied";
      } catch {}
    });
    qs("#importFen").addEventListener("click", () => {
      const txt = this.fenText.value.trim();
      if (!txt) return;
      if (this.game.load(txt)) {
        this.exitReview();
        this.syncBoard();
        this.refreshAll();
        this.engineStatus.textContent = "FEN loaded";
      } else {
        this.engineStatus.textContent = "Invalid FEN";
      }
    });
  }

  applyOrientation() {
    const side = this.sideSel.value;
    this.ui.setOrientation(side);
    const mode = this.modeSel?.value || "play";
    if (mode === "puzzle") {
      this.boardArea.classList.remove("flipped");
    } else {
      this.boardArea.classList.toggle("flipped", side === "black");
    }
  }

  startNewGame() {
    this.exitReview();
    this.lastCelebrationPly = -1;
    this.gameOver = false;
    this.cancelPreMove();
    this.game.reset();
    this.ui.stopCelebration?.();
    this.ui.clearUserArrows?.();
    this.ui.clearUserCircles?.();
    this.syncBoard();
    this.refreshAll();
    this.clockPanel.applyInputs?.();
    this.clockPanel.render();
    if (this.modeSel.value === "analysis") this.requestAnalysis();
    else if (this.modeSel.value === "play") {
      this.maybeEngineMove();
    } else if (this.modeSel.value === "puzzle") {
      this.puzzles.resetProgress();
      this.clockPanel.pause();
    }
  }

  updateSwitchButtonText() {
    const next = this.sideSel.value === "white" ? "black" : "white";
    this.switchBtn.textContent = `Switch to ${next} and restart`;
  }

  setMode(mode) {
    if (this.modeSel.value === mode) return;
    this.modeSel.value = mode;
    this.modeSel.dispatchEvent(new Event("change"));
  }

  updateModeButtonStyles() {
    this.modeBtns?.forEach((btn) => {
      btn.classList.toggle("primary", btn.dataset.mode === this.modeSel.value);
    });
  }

  // === Review hotkeys & click-to-exit ===
  bindReviewHotkeys() {
    window.addEventListener("keydown", (e) => {
      // Ignore when typing in inputs
      const t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const key = e.key;
      const histLen = this.getSanHistory().length;

      if (key === "ArrowLeft") {
        e.preventDefault();
        if (!this.inReview) {
          if (histLen === 0) return; // nothing to review
          this.enterReviewAt(histLen - 1); // go to last completed ply
        } else {
          this.setReviewPly(Math.max(0, this.reviewPly - 1));
        }
      } else if (key === "ArrowRight") {
        e.preventDefault();
        if (!this.inReview) return; // already live; nothing forward
        const next = Math.min(histLen, this.reviewPly + 1);
        if (next === histLen) this.exitReview();
        else this.setReviewPly(next);
      }
    });
  }

  bindBoardClickExitReview() {
    this.boardEl?.addEventListener("click", () => {
      if (this.inReview) this.exitReview();
    });
  }

  // === Review helpers ===
  enterReviewAt(ply) {
    this.inReview = true;
    this.setReviewPly(ply);
    // Disable interaction on the board (no moves while reviewing)
    this.ui.onUserMove = () => false;
    this.ui.getPieceAt = () => null; // prevent drag start
    this.ui.getLegalTargets = () => []; // no dots/highlights for moves
  }

  setReviewPly(ply) {
    const hist = this.getSanHistory();
    const clamped = Math.max(0, Math.min(hist.length, ply | 0));
    this.reviewPly = clamped;
    this.reviewFen = this.buildFenFromSan(hist.slice(0, clamped));
    this.syncBoard(); // will display review FEN
    this.refreshAll(); // updates popover with sliced moves
  }

  exitReview() {
    if (!this.inReview) return;
    this.inReview = false;
    this.reviewFen = null;

    // Restore live providers (board interaction enabled again)
    this.ui.onUserMove = this.onUserMove.bind(this);
    this.ui.getPieceAt = this.getPieceAt.bind(this);
    this.ui.getLegalTargets = this.getLegalTargets.bind(this);

    this.syncBoard(); // back to live fen
    this.refreshAll();
    this.maybeEngineMove(); // if engine to move, resume
  }

  getActiveFen() {
    return this.inReview && this.reviewFen ? this.reviewFen : this.game.fen();
  }

  buildFenFromSan(sanList) {
    // Rebuild a position from SANs using a temporary Game instance
    const g = new Game();
    for (const san of sanList) {
      g.moveSan(san);
    }
    return g.fen();
  }

  getPieceAt(sq) {
    const p = this.game.get(sq);
    if (this.modeSel.value === "play") {
      const human = this.sideSel.value === "white" ? "w" : "b";
      if (!p || p.color !== human) return null;
      return p;
    }
    const turn = this.game.turn();
    if (!p || p.color !== turn) return null;
    return p;
  }

  getLegalTargets(sq) {
    const p = this.game.get(sq);
    if (this.modeSel.value === "play") {
      const human = this.sideSel.value === "white" ? "w" : "b";
      if (!p || p.color !== human) return [];
      if (this.game.turn() !== human) {
        return this.game.premoveLegalMovesFrom(sq, human);
      }
      return this.game.legalMovesFrom(sq, human);
    }
    const turn = this.game.turn();
    if (!p || p.color !== turn) return [];
    return this.game.legalMovesFrom(sq);
  }

  playMoveSound(mv) {
    if (this.isMateNow()) return; // celebration handles the sound
    if (this.isCheckNow()) this.sounds.play("check");
    else this.sounds.play(mv?.captured ? "capture" : "move");
  }

  onUserMove({ from, to, promotion }) {
    if (this.inReview || this.gameOver) return false; // safety net
    if (this.modeSel.value === "play") {
      const human = this.sideSel.value === "white" ? "w" : "b";
      if (this.game.turn() !== human) {
        this.preMove = { from, to, promotion: promotion || "q" };
        this.ui.markPreMove?.(from, to);
        return true;
      }
    }
    const mv = this.game.move({ from, to, promotion: promotion || "q" });
    if (!mv) return false;
    this.playMoveSound(mv);

    if (this.modeSel.value === "play") {
      this.clock.onMoveApplied();
      this.clockPanel.startIfNotRunning();
    }
    if (this.modeSel.value === "puzzle") {
      const ok = this.puzzles.handleUserMove(mv);
      this.syncBoard();
      this.refreshAll();
      this.maybeCelebrate(); // celebration for puzzle mates as well
      this.checkGameOver();
      this.applyPreMove();
      return ok;
    }

    this.syncBoard();
    this.refreshAll();
    this.maybeCelebrate();
    this.checkGameOver();
    if (this.modeSel.value === "analysis") this.requestAnalysis();
    else if (this.modeSel.value === "play") this.maybeEngineMove();
    this.applyPreMove();
    return true;
  }

  applyPreMove() {
    if (!this.preMove) return;
    const mv = this.preMove;
    this.preMove = null;
    this.ui.clearArrow?.();
    this.ui.clearPreMove?.();
    this.onUserMove(mv);
  }

  cancelPreMove() {
    if (!this.preMove) return false;
    this.preMove = null;
    this.ui.clearPreMove?.();
    return true;
  }

  maybeEngineMove() {
    if (this.modeSel.value !== "play") return;
    if (this.inReview || this.gameOver) return; // don't move engine while browsing history
    const humanIs = this.sideSel.value === "white" ? "w" : "b";
    if (this.game.turn() !== humanIs) this.requestBestMove();
  }

  // === Opening book: ask boot.js for a SAN move before calling the engine
  askBookMove() {
    return new Promise((resolve) => {
      const onMove = (ev) => resolve(ev?.detail?.san || null);
      window.addEventListener("book:move", onMove, { once: true });
      const hist = this.getSanHistory();
      window.dispatchEvent(
        new CustomEvent("book:request", {
          detail: {
            sanHistory: hist.join(" "),
            ply: hist.length,
            mode: this.modeSel.value,
          },
        }),
      );
      setTimeout(() => resolve(null), 25); // tolerate missing listener
    });
  }

  async requestBestMove() {
    try {
      if (this.inReview || this.gameOver) return; // safety
      this.engineStatus.textContent = "Engine thinking...";

      // 1) Try the opening book first
      const san = await this.askBookMove();
      if (san) {
        const mv = this.game.moveSan(san);
        if (mv) {
          this.clock.onMoveApplied?.();
          const last = this.game.historyVerbose?.().slice(-1)[0] || mv;
          if (last?.from && last?.to)
            this.ui.drawArrowUci(
              last.from + last.to + (last.promotion || ""),
              true,
            );
          this.playMoveSound(mv);
          this.syncBoard();
          this.refreshAll();
          this.maybeCelebrate();
          this.checkGameOver();
          this.applyPreMove();
          this.engineStatus.textContent = "Book move";
          return;
        }
      }

      // 2) Fall back to the engine
      const eloPct = parseInt(this.elo.value, 10);
      const mapped = window.engineTuner?.mapElo
        ? window.engineTuner.mapElo(eloPct)
        : { elo: 3000 };
      const uci = await this.engine.play(this.game.fen(), {
        elo: mapped.elo,
        depthCap: parseInt(this.depth.value, 10),
        timeLeftMs:
          this.clock.turn === "w" ? this.clock.white : this.clock.black,
        incrementMs: this.clock.inc,
      });
      if (uci) {
        const mv = this.game.moveUci(uci);
        if (this.modeSel.value === "play") this.clock.onMoveApplied();
        this.playMoveSound(mv);
        this.syncBoard();
        this.refreshAll();
        this.ui.drawArrowUci(uci, true);
        this.maybeCelebrate();
        this.checkGameOver();
        this.applyPreMove();
      }
      this.engineStatus.textContent = "Engine: move played";
    } catch (e) {
      this.engineStatus.textContent = "Engine error: " + e.message;
      console.error(e);
    }
  }

  async requestAnalysis() {
    try {
      if (this.inReview || this.gameOver) return; // keep analysis tied to current position only
      this.engineStatus.textContent = "Analyzing...";
      const lines = await this.engine.analyze(this.game.fen(), {
        depth: parseInt(this.depth.value, 10),
        multipv: parseInt(this.multipv.value, 10),
        timeMs: window.engineTuner?.lastMovetime || 300,
      });
      this.ui.clearArrow?.();
      (lines || []).forEach((l, i) => {
        if (l.firstUci) this.ui.drawArrowUci(l.firstUci, i === 0);
      });
      if (lines && lines[0]) this.updateEvalFromCp(lines[0].scoreCp);
      this.engineStatus.textContent = "Engine: ready";

      this.pvBox.innerHTML = (lines || [])
        .map(
          (it, i) =>
            `<div>PV${i + 1}: <b>${(it.scoreCp / 100).toFixed(2)}</b> — <span class="muted">${(it.san || []).join(" ")}</span></div>`,
        )
        .join("");
    } catch (e) {
      this.engineStatus.textContent = "Engine error: " + e.message;
      console.error(e);
    }
  }

  async requestHint() {
    try {
      if (this.inReview || this.gameOver) return;
      this.engineStatus.textContent = "Hint...";
      const lines = await this.engine.analyze(this.game.fen(), {
        depth: Math.max(2, parseInt(this.depth.value, 10)),
        multipv: 1,
        timeMs: window.engineTuner?.lastMovetime || 300,
      });
      if (lines && lines[0]?.firstUci) this.ui.drawArrowUci(lines[0].firstUci);
      if (lines && lines[0]) this.updateEvalFromCp(lines[0].scoreCp);
      this.engineStatus.textContent = "Engine: ready";
    } catch (e) {
      this.engineStatus.textContent = "Engine error: " + e.message;
      console.error(e);
    }
  }

  updateEvalFromCp(cp) {
    const clamped = Math.max(-1000, Math.min(1000, cp | 0));
    const pct = 50 + clamped / 20;
    this.evalbar.style.display = "block";
    this.evalWhite.style.height = `${Math.max(0, Math.min(100, pct))}%`;
    this.evalBlack.style.height = `${Math.max(0, Math.min(100, 100 - pct))}%`;
  }

  syncBoard() {
    this.applyOrientation();
    this.ui.setFen(this.getActiveFen());
    const ply = this.inReview ? this.reviewPly : this.getSanHistory().length;
    const inst = window.DrawOverlayInstance;
    if (inst && typeof inst.restoreSnapshotForPly === "function")
      inst.restoreSnapshotForPly(ply);
  }

  refreshAll() {
    this.updateStatusMinimal();
    this.updateGameInfo();
  }

  updateStatusMinimal() {
    // Minimal status; detailed info is in the card.
  }

  updateGameInfo() {
    if (!this.infoTurn || !this.infoOpening || !this.infoMoves) return;

    // 1) Turn
    let turnSide;
    if (this.inReview) {
      turnSide = this.reviewPly % 2 === 0 ? "White" : "Black";
    } else {
      turnSide = this.game.turn() === "w" ? "White" : "Black";
    }

    // 2) Opening (best prefix match)
    const sanHistFull = this.getSanHistory();
    const sanHist = this.inReview
      ? sanHistFull.slice(0, this.reviewPly)
      : sanHistFull;
    const openingName = detectOpening(sanHist) || "—";

    // 3) Moves (numbered, compact)
    const movesText = this.formatMoves(sanHist) || "—";

    this.infoTurn.textContent = turnSide + (this.inReview ? " (review)" : "");
    this.infoOpening.textContent = openingName;
    this.infoMoves.textContent = movesText;
  }

  getSanHistory() {
    if (typeof this.game.history === "function") {
      const h = this.game.history();
      if (Array.isArray(h)) return h;
    }
    if (this.game.ch && typeof this.game.ch.history === "function") {
      const h = this.game.ch.history();
      if (Array.isArray(h)) return h;
    }
    const pgn =
      typeof this.game.pgn === "function" ? String(this.game.pgn() || "") : "";
    const tail = pgn.split("\n\n").pop() || "";
    return tail
      .trim()
      .split(/\s+/)
      .filter((x) => !/^\d+\.(\.\.)?$/.test(x) && x !== "*");
  }

  formatMoves(sanList) {
    if (!sanList || !sanList.length) return "";
    let out = [];
    let num = 1;
    for (let i = 0; i < sanList.length; i += 2) {
      const white = sanList[i] || "";
      const black = sanList[i + 1] || "";
      if (black) out.push(`${num}. ${white} ${black}`);
      else out.push(`${num}. ${white}`);
      num++;
    }
    return out.join(" ");
  }

  checkGameOver() {
    const g = this.game?.ch;
    if (
      g &&
      ((typeof g.isGameOver === "function" && g.isGameOver()) ||
        (typeof g.game_over === "function" && g.game_over()))
    ) {
      this.gameOver = true;
      this.clock.pause();
      this.clockPanel.render?.();
      this.engine.stop?.();
      return true;
    }
    return false;
  }

  // === Check & Mate detection & celebration ===
  isCheckNow() {
    const lastSan = this.getSanHistory().slice(-1)[0] || "";
    if (/\+$/.test(lastSan)) return true;
    if (typeof this.game.isCheck === "function" && this.game.isCheck())
      return true;
    if (typeof this.game.inCheck === "function" && this.game.inCheck())
      return true;
    if (this.game.ch) {
      const ch = this.game.ch;
      if (typeof ch.in_check === "function" && ch.in_check()) return true;
      if (typeof ch.isCheck === "function" && ch.isCheck()) return true;
    }
    return false;
  }

  isMateNow() {
    // 1) Library-agnostic: last SAN ends with '#'
    const lastSan = this.getSanHistory().slice(-1)[0] || "";
    if (/#$/.test(lastSan)) return true;

    // 2) Wrapper APIs (various naming schemes)
    if (typeof this.game.isCheckmate === "function" && this.game.isCheckmate())
      return true;
    if (typeof this.game.inCheckmate === "function" && this.game.inCheckmate())
      return true;

    // 3) Underlying chess.js (if exposed)
    if (this.game.ch) {
      const ch = this.game.ch;
      if (typeof ch.in_checkmate === "function" && ch.in_checkmate())
        return true;
      if (typeof ch.isCheckmate === "function" && ch.isCheckmate()) return true;
    }

    // 4) Fallback: game over but not draw (not perfect, but harmless)
    if (
      typeof this.game.isGameOver === "function" &&
      typeof this.game.isDraw === "function"
    ) {
      if (this.game.isGameOver() && !this.game.isDraw()) return true;
    }
    if (this.game.ch) {
      const ch = this.game.ch;
      if (
        typeof ch.game_over === "function" &&
        typeof ch.in_draw === "function"
      ) {
        if (ch.game_over() && !ch.in_draw()) return true;
      }
    }
    return false;
  }

  maybeCelebrate() {
    if (this.inReview) return; // never in review
    const ply = this.getSanHistory().length;
    if (this.isMateNow() && this.lastCelebrationPly !== ply) {
      this.lastCelebrationPly = ply;
      let kingSq = null;
      try {
        const turn = this.game.turn();
        const board = this.game.ch.board();
        const files = "abcdefgh";
        outer: for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (piece && piece.type === "k" && piece.color === turn) {
              kingSq = files[f] + (8 - r);
              break outer;
            }
          }
        }
      } catch {}
      this.sounds.play("airhorn");
      this.ui.celebrate?.(kingSq);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => new App());
