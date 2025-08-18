import { Chess } from "../vendor/chess.mjs";
import { adaptLichessPuzzle } from "./PuzzleModel.js";
import { diffToRange } from "./PuzzleService.js";

function on(el, type, fn) {
  if (el) el.addEventListener(type, fn);
}

const DIFF_LABELS = [
  "Easiest",
  "Very Easy",
  "Easy",
  "Casual",
  "Medium",
  "Challenging",
  "Hard",
  "Very Hard",
  "Expert",
  "Legendary",
];

const THEMES = [
  "advancedPawn",
  "advantage",
  "anastasiaMate",
  "arabianMate",
  "attackingF2F7",
  "attraction",
  "backRankMate",
  "bishopEndgame",
  "bodenMate",
  "capturingDefender",
  "castling",
  "clearance",
  "crushing",
  "defensiveMove",
  "deflection",
  "discoveredAttack",
  "doubleBishopMate",
  "doubleCheck",
  "dovetailMate",
  "enPassant",
  "endgame",
  "equality",
  "exposedKing",
  "fork",
  "hangingPiece",
  "hookMate",
  "interference",
  "intermezzo",
  "killBoxMate",
  "kingsideAttack",
  "knightEndgame",
  "long",
  "master",
  "masterVsMaster",
  "mate",
  "mateIn1",
  "mateIn2",
  "mateIn3",
  "mateIn4",
  "mateIn5",
  "middlegame",
  "oneMove",
  "opening",
  "pawnEndgame",
  "pin",
  "promotion",
  "queenEndgame",
  "queenRookEndgame",
  "queensideAttack",
  "quietMove",
  "rookEndgame",
  "sacrifice",
  "short",
  "skewer",
  "smotheredMate",
  "superGM",
  "trappedPiece",
  "underPromotion",
  "veryLong",
  "vukovicMate",
  "xRayAttack",
  "zugzwang",
];

export class PuzzleUI {
  constructor({
    game,
    ui,
    service,
    dom,
    onStateChanged,
    onMove,
    onPuzzleLoad,
  }) {
    this.game = game;
    this.ui = ui;
    this.svc = service;
    this.dom = dom || {};
    this.onStateChanged = onStateChanged || (() => {});
    this.onMove = onMove || (() => {});
    this.onPuzzleLoad = onPuzzleLoad || (() => {});
    this.current = null;
    this.index = 0;
    this.autoplayFirst = false;
    this.hintStage = 0;
    this.hintSquare = null;

    this.bindDom();
    this.populateOpenings();
    this.populateThemes();
  }

  show(flag) {
    if (this.dom?.panelTop)
      this.dom.panelTop.style.display = flag ? "" : "none";
    if (this.dom?.panelBottom)
      this.dom.panelBottom.style.display = flag ? "" : "none";
    if (this.dom?.clockBlack)
      this.dom.clockBlack.style.display = flag ? "none" : "";
    if (this.dom?.clockWhite)
      this.dom.clockWhite.style.display = flag ? "none" : "";
  }
  resetProgress() {
    this.index = 0;
    this.autoplayFirst = false;
    if (this.dom?.puzzleStatus) this.dom.puzzleStatus.textContent = "";
    this.clearHint();
  }

  async populateOpenings() {
    try {
      const map = await this.svc.listOpenings();
      if (!this.dom?.openingSel) return;
      const opts = ['<option value="">Any</option>'];
      for (const name of Object.keys(map).sort()) {
        opts.push(
          `<option value="${name}">${name.replace(/_/g, " ")}</option>`,
        );
      }
      this.dom.openingSel.innerHTML = opts.join("");
    } catch {}
  }

  populateThemes() {
    try {
      if (!this.dom?.themeSel) return;
      const opts = ['<option value="">Any</option>'];
      for (const name of THEMES) {
        const label = name
          .replace(/_/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2");
        opts.push(`<option value="${name}">${label}</option>`);
      }
      this.dom.themeSel.innerHTML = opts.join("");
    } catch {}
  }

  bindDom() {
    const d = this.dom;

    on(d.fetchDailyBtn, "click", async () => {
      try {
        const p = await this.svc.fetchDaily();
        this.loadConvertedPuzzle(p);
      } catch (e) {
        alert("Daily fetch failed: " + e.message);
      }
    });

    const loadFiltered = () => this.loadFilteredRandom();
    on(d.newPuzzleBtn, "click", loadFiltered);
    on(d.hintBtn, "click", () => this.hint());

    const updateDiff = () => {
      const val = parseInt(d.difficultyRange?.value || "5", 10);
      if (d.difficultyLabel) {
        const [min, max] = diffToRange(val);
        d.difficultyLabel.textContent = `${DIFF_LABELS[val - 1] || ""} (${min}-${max})`;
      }
    };
    on(d.difficultyRange, "input", updateDiff);
    updateDiff();
  }

  async loadFilteredRandom() {
    try {
      const diff = parseInt(this.dom.difficultyRange?.value || "5", 10);
      const opening = this.dom.openingSel?.value || "";
      const theme = this.dom.themeSel?.value || "";
      const themes = theme ? [theme] : [];
      const p = await this.svc.randomFiltered({
        difficulty: diff,
        opening,
        themes,
      });
      if (!p) {
        alert("No puzzle matches your filter.");
        return;
      }
      await this.loadConvertedPuzzle({ ...p, autoplayFirst: true });
    } catch (e) {
      alert("Failed to load puzzle: " + e.message);
    }
  }

  async loadConvertedPuzzle(p) {
    try {
      const c = await adaptOrIdentity(p);
      this.current = c;
      this.index = 0;
      this.autoplayFirst = !!p.autoplayFirst;
      this.applyCurrent(true);
    } catch (e) {
      alert("Failed to convert puzzle: " + e.message);
    }
  }

  applyCurrent(center = false) {
    if (!this.current) return;
    this.game.load?.(this.current.fen);
    this.clearHint();

    if (this.autoplayFirst && this.current.solutionSan?.length > 0) {
      const first = this.current.solutionSan[0];
      const applied = this.game.moveSan?.(first);
      if (applied) {
        this.onMove(applied);
        this.index = 1;
      }
    }

    if (this.dom?.puzzleInfo) {
      const rating = this.current.rating ? ` — ${this.current.rating}` : "";
      const opening = this.current.opening
        ? ` — <span class="muted">${this.current.opening.replace(/_/g, " ")}</span>`
        : "";
      this.dom.puzzleInfo.innerHTML = `<b>Puzzle</b> #${this.current.id || "local"}${rating}${opening}`;
    }
    if (this.dom?.puzzleStatus) {
      const turn = this.game.turn?.();
      const text = turn === "w" ? "White to move" : "Black to move";
      this.dom.puzzleStatus.innerHTML = `<span style="color:#8aa0b6">${text}</span>`;
    }

    this.onPuzzleLoad(this.game.turn?.());
    this.onStateChanged();
    if (center && this.ui?.resizeOverlay) this.ui.resizeOverlay();
  }

  clearHint() {
    if (this.hintSquare)
      this.ui.squareEl?.(this.hintSquare)?.classList?.remove("hl-hint");
    this.hintSquare = null;
    this.ui.clearArrow?.();
    this.hintStage = 0;
  }

  handleUserMove(mv) {
    this.clearHint();
    const sanNeeded = this.current?.solutionSan?.[this.index];
    if (!sanNeeded) return false;

    const userSan = mv?.san;
    if (userSan === sanNeeded) {
      this.index++;
      if (this.dom?.puzzleStatus)
        this.dom.puzzleStatus.innerHTML = `<span style="color:#39d98a">Correct!</span>`;
      if (this.index >= (this.current?.solutionSan?.length || 0)) {
        if (this.dom?.puzzleStatus)
          this.dom.puzzleStatus.innerHTML = `<span style="color:#39d98a">Solved 🎉</span>`;
        return true;
      } else {
        const reply = this.current.solutionSan[this.index];
        const applied = this.game.moveSan(reply);
        if (applied) {
          this.onMove(applied);
          this.index++;
          this.onStateChanged();
          if (this.dom?.puzzleStatus)
            this.dom.puzzleStatus.innerHTML = `<span style="color:#8aa0b6">Your move…</span>`;
          return true;
        } else {
          return true;
        }
      }
    } else {
      if (this.dom?.puzzleStatus)
        this.dom.puzzleStatus.innerHTML = `<span style="color:#ff6b6b">Try again.</span>`;
      this.game.undo();
      return false;
    }
  }

  hint() {
    const san = this.current?.solutionSan?.[this.index];
    if (!san) return;
    const tmp = new Chess(this.game.fen());
    const m = tmp.move(san);
    if (!m) return;
    if (this.hintStage === 0) {
      this.clearHint();
      this.hintSquare = m.from;
      this.ui.squareEl?.(m.from)?.classList?.add("hl-hint");
      this.hintStage = 1;
    } else {
      if (this.hintSquare)
        this.ui.squareEl?.(this.hintSquare)?.classList?.remove("hl-hint");
      this.hintSquare = null;
      this.ui.clearArrow?.();
      this.ui.drawArrowUci?.(m.from + m.to + (m.promotion || ""));
      this.hintStage = 2;
    }
  }
}

export async function adaptOrIdentity(p) {
  if (!p) throw new Error("No puzzle data");
  if (p.puzzle || p.id || p.PuzzleId) {
    return adaptLichessPuzzle(p);
  }
  if (!p.fen) throw new Error("Puzzle missing FEN");
  return {
    id: p.id || "local",
    fen: p.fen,
    themes: p.themes || p.thema || "",
    solutionSan: (p.solution || []).slice(),
    rating: p.rating || 0,
    opening: p.openingTags || p.opening || "",
    gameUrl: p.gameUrl || "",
  };
}
