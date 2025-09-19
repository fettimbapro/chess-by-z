import { Chess } from "../vendor/chess.mjs";
import { adaptLichessPuzzle } from "./PuzzleModel.js";

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

    this.rushDuration = 180;
    this.rushMaxLives = 3;
    this.rushTimerId = null;
    this.rushActive = false;
    this.rushScore = 0;
    this.rushLives = this.rushMaxLives;
    this.rushTimeRemaining = this.rushDuration;
    this.rushHighScore = this.loadRushHighScore();

    this.bindDom();
    this.populateOpenings();
    this.populateThemes();
    this.updateRushDisplay();
    this.updateRushStatus("Puzzle Rush ready.");
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
    if (this.dom?.rushPanel)
      this.dom.rushPanel.style.display = flag ? "" : "none";
    if (!flag) this.cancelRush();
  }
  showLoading(flag) {
    if (this.dom?.puzzleLoading)
      this.dom.puzzleLoading.style.display = flag ? "flex" : "none";
  }
  resetProgress() {
    this.cancelRush();
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
    const loadFiltered = () => this.loadFilteredRandom();
    on(d.newPuzzleBtn, "click", loadFiltered);
    on(d.hintBtn, "click", () => this.hint());

    on(d.rushStartBtn, "click", () => this.startRush());
    on(d.rushStopBtn, "click", () => this.stopRush());

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
    on(d.difficultyMin, "change", () => {
      updateDiffLabel("min");
      this.updateFilterCount();
    });
    on(d.difficultyMax, "change", () => {
      updateDiffLabel("max");
      this.updateFilterCount();
    });
    updateDiffLabel();
  }

  async loadFilteredRandom() {
    if (this.rushActive) return;
    this.showLoading(true);
    try {
      const parseVal = (el) =>
        el && el.value !== "" ? parseInt(el.value, 10) : null;
      const diffMin = parseVal(this.dom.difficultyMin);
      const diffMax = parseVal(this.dom.difficultyMax);
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
    } finally {
      this.showLoading(false);
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
      if (!this.rushActive) this.updateFilterCount();
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
    if (this.rushActive) {
      this.dom.puzzleCount.textContent = "";
      return;
    }
    try {
      const parseVal = (el) =>
        el && el.value !== "" ? parseInt(el.value, 10) : null;
      const diffMin = parseVal(this.dom.difficultyMin);
      const diffMax = parseVal(this.dom.difficultyMax);
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
    } catch {
      this.dom.puzzleCount.textContent = "";
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
        if (this.rushActive) this.handleRushSuccess();
        else this.promptNewPuzzle();
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
          if (
            this.rushActive &&
            this.index >= (this.current?.solutionSan?.length || 0)
          ) {
            this.handleRushSuccess();
          }
          return true;
        } else {
          return true;
        }
      }
    } else {
      if (this.rushActive) {
        this.handleRushMistake();
      } else {
        if (this.dom?.puzzleStatus)
          this.dom.puzzleStatus.innerHTML = `<span style="color:#ff6b6b">Try again.</span>`;
        window.MoveFlash?.flash({ color: "255,107,107" });
      }
      this.game.undo();
      return false;
    }
  }

  promptNewPuzzle() {
    if (this.rushActive) return;
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

  startRush() {
    if (this.rushActive) return;
    this.hidePuzzlePrompt();
    this.rushScore = 0;
    this.rushLives = this.rushMaxLives;
    this.rushTimeRemaining = this.rushDuration;
    this.rushActive = true;
    this.seenIds.clear();
    this.updateRushDisplay();
    this.updateRushStatus("Puzzle Rush started!");
    if (this.dom?.rushStartBtn) this.dom.rushStartBtn.disabled = true;
    if (this.dom?.rushStopBtn) this.dom.rushStopBtn.disabled = false;
    if (this.dom?.newPuzzleBtn) this.dom.newPuzzleBtn.disabled = true;
    if (this.dom?.hintBtn) this.dom.hintBtn.disabled = true;
    if (this.rushTimerId) clearInterval(this.rushTimerId);
    this.rushTimerId = setInterval(() => {
      if (!this.rushActive) return;
      this.rushTimeRemaining = Math.max(0, this.rushTimeRemaining - 1);
      this.updateRushDisplay();
      if (this.rushTimeRemaining <= 0) {
        this.finishRush("time");
      }
    }, 1000);
    this.loadNextRushPuzzle(true);
  }

  stopRush() {
    if (!this.rushActive) return;
    this.finishRush("manual");
  }

  finishRush(reason) {
    if (this.rushTimerId) {
      clearInterval(this.rushTimerId);
      this.rushTimerId = null;
    }
    const wasActive = this.rushActive;
    this.rushActive = false;
    if (this.dom?.rushStartBtn) this.dom.rushStartBtn.disabled = false;
    if (this.dom?.rushStopBtn) this.dom.rushStopBtn.disabled = true;
    if (this.dom?.newPuzzleBtn) this.dom.newPuzzleBtn.disabled = false;
    if (this.dom?.hintBtn) this.dom.hintBtn.disabled = false;
    if (!wasActive && reason !== "error") {
      this.updateRushStatus("Puzzle Rush ready.");
      return;
    }
    const finalScore = this.rushScore;
    const isHigh = this.saveRushHighScore(finalScore);
    this.updateRushDisplay();
    let msg = "Puzzle Rush finished.";
    if (reason === "time") msg = "⏱️ Time's up!";
    else if (reason === "lives") msg = "❌ No lives left.";
    else if (reason === "manual") msg = "⏹️ Rush stopped.";
    else if (reason === "empty") msg = "No more puzzles matched the ramp.";
    else if (reason === "error") msg = "Puzzle Rush ended early.";
    if (finalScore > 0) msg += ` Final score: ${finalScore}.`;
    if (isHigh && finalScore > 0) msg += " New high score!";
    this.updateRushStatus(msg.trim());
    this.showRushSummary(finalScore, isHigh, reason);
  }

  cancelRush() {
    if (this.rushTimerId) {
      clearInterval(this.rushTimerId);
      this.rushTimerId = null;
    }
    this.rushActive = false;
    this.rushScore = 0;
    this.rushLives = this.rushMaxLives;
    this.rushTimeRemaining = this.rushDuration;
    if (this.dom?.rushStartBtn) this.dom.rushStartBtn.disabled = false;
    if (this.dom?.rushStopBtn) this.dom.rushStopBtn.disabled = true;
    if (this.dom?.newPuzzleBtn) this.dom.newPuzzleBtn.disabled = false;
    if (this.dom?.hintBtn) this.dom.hintBtn.disabled = false;
    this.updateRushDisplay();
    this.updateRushStatus("Puzzle Rush ready.");
    this.hidePuzzlePrompt();
  }

  handleRushSuccess() {
    if (!this.rushActive) return;
    this.rushScore++;
    this.updateRushDisplay();
    if (this.dom?.puzzleStatus)
      this.dom.puzzleStatus.innerHTML = `<span style="color:#39d98a">Score: ${this.rushScore}</span>`;
    this.hidePuzzlePrompt();
    setTimeout(() => {
      if (this.rushActive) this.loadNextRushPuzzle();
    }, 400);
  }

  handleRushMistake() {
    if (!this.rushActive) return;
    this.rushLives = Math.max(0, this.rushLives - 1);
    this.updateRushDisplay();
    window.MoveFlash?.flash({ color: "255,107,107" });
    if (this.dom?.puzzleStatus) {
      const text = this.rushLives
        ? `Incorrect — ${this.rushLives} lives left`
        : "Incorrect — no lives left";
      this.dom.puzzleStatus.innerHTML = `<span style="color:#ff6b6b">${text}</span>`;
    }
    if (this.rushLives <= 0) {
      this.finishRush("lives");
    } else {
      setTimeout(() => {
        if (this.rushActive) this.loadNextRushPuzzle();
      }, 400);
    }
  }

  async loadNextRushPuzzle() {
    if (!this.rushActive) return;
    this.showLoading(true);
    try {
      const difficulty = this.getRushDifficulty(this.rushScore);
      const p = await this.svc.randomFiltered({
        ...difficulty,
        excludeIds: Array.from(this.seenIds),
      });
      if (!p) {
        this.finishRush("empty");
        return;
      }
      await this.loadConvertedPuzzle({ ...p, autoplayFirst: false });
      if (this.dom?.puzzleStatus)
        this.dom.puzzleStatus.innerHTML = `<span style="color:#8aa0b6">Your move…</span>`;
    } catch (e) {
      this.updateRushStatus("Failed to load puzzle.");
      this.finishRush("error");
    } finally {
      this.showLoading(false);
    }
  }

  getRushDifficulty(score) {
    const base = 400 + score * 75;
    const min = Math.max(0, Math.min(3300, base));
    const max = Math.max(min + 50, Math.min(3500, base + 250));
    return { difficultyMin: min, difficultyMax: max };
  }

  updateRushDisplay() {
    if (this.dom?.rushTimer)
      this.dom.rushTimer.textContent = this.formatRushTime(
        this.rushTimeRemaining,
      );
    if (this.dom?.rushScore)
      this.dom.rushScore.textContent = String(this.rushScore);
    if (this.dom?.rushBest)
      this.dom.rushBest.textContent = String(Math.max(this.rushHighScore, 0));
    if (this.dom?.rushLives)
      this.dom.rushLives.textContent = String(this.rushLives);
  }

  updateRushStatus(text) {
    if (this.dom?.rushStatus) this.dom.rushStatus.textContent = text;
  }

  saveRushHighScore(score) {
    if (score <= this.rushHighScore) return false;
    this.rushHighScore = score;
    try {
      globalThis?.localStorage?.setItem("puzzleRushHighScore", String(score));
    } catch {}
    this.updateRushDisplay();
    return true;
  }

  loadRushHighScore() {
    try {
      const raw = globalThis?.localStorage?.getItem("puzzleRushHighScore");
      const val = parseInt(raw, 10);
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  }

  showRushSummary(score, isHighScore, reason) {
    if (!this.dom?.puzzlePrompt) return;
    this.dom.puzzlePrompt.style.display = "flex";
    const reasonText =
      reason === "time"
        ? "Time's up!"
        : reason === "lives"
          ? "No lives left."
          : reason === "manual"
            ? "Rush stopped."
            : reason === "empty"
              ? "Out of puzzles."
              : "Rush finished.";
    const high = isHighScore ? '<div class="muted">New high score!</div>' : "";
    this.dom.puzzlePrompt.innerHTML = `
      <div class="box">
        <div><strong>Puzzle Rush</strong> — ${reasonText}</div>
        <div>Score: ${score}</div>
        <div>Best: ${this.rushHighScore}</div>
        ${high}
        <button id="rushPlayAgain">Play again</button>
      </div>
    `;
    const btn = this.dom.puzzlePrompt.querySelector("#rushPlayAgain");
    on(btn, "click", () => {
      this.hidePuzzlePrompt();
      this.startRush();
    });
  }

  hidePuzzlePrompt() {
    if (this.dom?.puzzlePrompt) {
      this.dom.puzzlePrompt.style.display = "none";
      this.dom.puzzlePrompt.innerHTML = "";
    }
  }

  formatRushTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
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
