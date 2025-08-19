import { Chess } from "../vendor/chess.mjs";
import { adaptLichessPuzzle } from "./PuzzleModel.js";
import { logError } from "../util/ErrorHandler.js";

function on(el, type, fn) {
  if (el) el.addEventListener(type, fn);
}

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
    this.seenIds = new Set();

    this.bindDom();
    this.populateOpenings();
    this.populateThemes();
    this.updateFilterCount();
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
    if (this.dom?.puzzlePrompt) {
      this.dom.puzzlePrompt.style.display = "none";
      this.dom.puzzlePrompt.innerHTML = "";
    }
    this.clearHint();
    this.updateFilterCount();
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
    } catch (err) {
      logError(err, "PuzzleUI.populateOpenings");
      if (this.dom?.puzzleStatus)
        this.dom.puzzleStatus.textContent = "Failed to load openings";
    }
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
    } catch (err) {
      logError(err, "PuzzleUI.populateThemes");
    }
  }

  bindDom() {
    const d = this.dom;
    const loadFiltered = () => this.loadFilteredRandom();
    on(d.newPuzzleBtn, "click", loadFiltered);
    on(d.hintBtn, "click", () => this.hint());

    on(d.openingSel, "change", () => this.updateFilterCount());
    on(d.themeSel, "change", () => this.updateFilterCount());

    if (d.difficultyMin && d.difficultyMax) {
      const opts = ['<option value="">∞</option>'];
      for (let i = 0; i <= 3500; i += 100) {
        opts.push(`<option value="${i}">${i}</option>`);
      }
      const html = opts.join("");
      d.difficultyMin.innerHTML = html;
      d.difficultyMax.innerHTML = html;
    }

    const parseVal = (el) =>
      el && el.value !== "" ? parseInt(el.value, 10) : null;
    const updateDiffLabel = (src) => {
      let minVal = parseVal(d.difficultyMin);
      let maxVal = parseVal(d.difficultyMax);
      if (minVal != null && maxVal != null && minVal > maxVal) {
        if (src === "min") {
          maxVal = minVal;
          if (d.difficultyMax) d.difficultyMax.value = String(maxVal);
        } else {
          minVal = maxVal;
          if (d.difficultyMin) d.difficultyMin.value = String(minVal);
        }
      }
      if (d.difficultyLabel) {
        let text = "Any";
        if (minVal != null && maxVal != null) text = `${minVal}-${maxVal}`;
        else if (minVal != null) text = `≥${minVal}`;
        else if (maxVal != null) text = `≤${maxVal}`;
        d.difficultyLabel.textContent = text;
      }
    };
    const syncDiffEnabled = () => {
      const enabled = d.difficultyFilter?.checked;
      if (d.difficultyMin) d.difficultyMin.disabled = !enabled;
      if (d.difficultyMax) d.difficultyMax.disabled = !enabled;
      if (enabled) updateDiffLabel();
      else if (d.difficultyLabel) d.difficultyLabel.textContent = "Any";
      this.updateFilterCount();
    };
    on(d.difficultyFilter, "change", syncDiffEnabled);
    on(d.difficultyMin, "change", () => {
      updateDiffLabel("min");
      this.updateFilterCount();
    });
    on(d.difficultyMax, "change", () => {
      updateDiffLabel("max");
      this.updateFilterCount();
    });
    syncDiffEnabled();
  }

  async loadFilteredRandom() {
    try {
      const diffEnabled = this.dom.difficultyFilter?.checked;
      const parseVal = (el) =>
        el && el.value !== "" ? parseInt(el.value, 10) : null;
      const diffMin = diffEnabled ? parseVal(this.dom.difficultyMin) : null;
      const diffMax = diffEnabled ? parseVal(this.dom.difficultyMax) : null;
      const opening = this.dom.openingSel?.value || "";
      const theme = this.dom.themeSel?.value || "";
      const themes = theme ? [theme] : [];
      const opts = {
        opening,
        themes,
        excludeIds: Array.from(this.seenIds),
      };
      if (diffMin !== null) opts.difficultyMin = diffMin;
      if (diffMax !== null) opts.difficultyMax = diffMax;
      const p = await this.svc.randomFiltered(opts);
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
      this.current = { ...c, daily: p.daily };
      if (this.current.id) this.seenIds.add(this.current.id);
      this.index = 0;
      this.autoplayFirst = !!p.autoplayFirst;
      this.applyCurrent(true);
      this.updateFilterCount();
      if (this.dom?.puzzlePrompt) {
        this.dom.puzzlePrompt.style.display = "none";
        this.dom.puzzlePrompt.innerHTML = "";
      }
    } catch (e) {
      alert("Failed to convert puzzle: " + e.message);
    }
  }

  async updateFilterCount() {
    if (!this.dom?.puzzleCount) return;
    try {
      const diffEnabled = this.dom.difficultyFilter?.checked;
      const parseVal = (el) =>
        el && el.value !== "" ? parseInt(el.value, 10) : null;
      const diffMin = diffEnabled ? parseVal(this.dom.difficultyMin) : null;
      const diffMax = diffEnabled ? parseVal(this.dom.difficultyMax) : null;
      const opening = this.dom.openingSel?.value || "";
      const theme = this.dom.themeSel?.value || "";
      const themes = theme ? [theme] : [];
      const opts = {
        opening,
        themes,
        excludeIds: Array.from(this.seenIds),
      };
      if (diffMin !== null) opts.difficultyMin = diffMin;
      if (diffMax !== null) opts.difficultyMax = diffMax;
      const count = await this.svc.countFiltered(opts);
      const noun = count === 1 ? "puzzle" : "puzzles";
      const verb = count === 1 ? "fits" : "fit";
      this.dom.puzzleCount.textContent = `${count} ${noun} ${verb} your filter`;
    } catch (err) {
      logError(err, "PuzzleUI.updateFilterCount");
      this.dom.puzzleCount.textContent = "Error fetching count";
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
      const label = this.current.daily ? "Daily puzzle" : "Puzzle";
      this.dom.puzzleInfo.innerHTML = `<b>${label}</b> #${
        this.current.id || "local"
      }${rating}${opening}`;
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
        this.promptNewPuzzle();
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
      window.MoveFlash?.flash({ color: "255,107,107" });
      this.game.undo();
      return false;
    }
  }

  promptNewPuzzle() {
    if (this.dom?.puzzleStatus) this.dom.puzzleStatus.textContent = "";
    if (!this.dom?.puzzlePrompt) return;
    this.dom.puzzlePrompt.innerHTML =
      '<div class="box"><span style="color:#39d98a">Solved 🎉</span><button id="nextPuzzle">New Puzzle?</button></div>';
    this.dom.puzzlePrompt.style.display = "flex";
    const btn = this.dom.puzzlePrompt.querySelector("#nextPuzzle");
    on(btn, "click", () => this.loadFilteredRandom());
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
