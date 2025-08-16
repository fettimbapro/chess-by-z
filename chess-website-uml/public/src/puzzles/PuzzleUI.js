import { Chess } from "../vendor/chess.mjs";
import { adaptLichessPuzzle } from "./PuzzleModel.js";

// Small helper: bind only if the element exists
function on(el, type, fn) {
  if (el) el.addEventListener(type, fn);
}

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
    this.playlist = [];
    this.playIndex = -1;

    this.bindDom();
    this.updatePackInfo();
  }

  show(flag) {
    if (this.dom?.panel) this.dom.panel.style.display = flag ? "" : "none";
  }
  updatePackInfo() {
    if (!this.dom?.packInfo) return;
    this.dom.packInfo.textContent = this.svc?.size?.()
      ? `Local pack: ${this.svc.size()} puzzles`
      : "No local pack.";
  }
  resetProgress() {
    this.index = 0;
    if (this.dom?.puzzleStatus) this.dom.puzzleStatus.textContent = "";
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

    on(d.loadByIdBtn, "click", async () => {
      const id = (d.puzzleIdInput?.value || "").trim();
      if (!id) {
        alert("Enter a puzzle ID");
        return;
      }
      try {
        const p = await this.svc.fetchById(id);
        this.loadConvertedPuzzle(p);
      } catch (e) {
        alert("ID fetch failed: " + e.message);
      }
    });

    on(d.importCsvBtn, "click", () => d.importCsvFile?.click());
    on(d.importCsvFile, "change", async (ev) => {
      const file = ev?.target?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const n = this.svc.importCsvText(text, 3000);
      this.updatePackInfo();
      alert(`Imported ${n} puzzles.`);
    });

    on(d.downloadPackBtn, "click", async () => {
      try {
        const url = (d.packUrlInput?.value || "").trim();
        if (!url) {
          alert("Enter a pack URL");
          return;
        }
        const text = await (await fetch(url)).text();
        const n = this.svc.importCsvText(text, 10000);
        this.updatePackInfo();
        alert(`Imported ${n} puzzles from URL.`);
      } catch (e) {
        alert("Download failed: " + e.message);
      }
    });

    on(d.demoPackBtn, "click", () => {
      this.svc.pack = DEMO_PACK.slice();
      this.svc.save?.();
      this.updatePackInfo();
      alert(`Loaded demo pack: ${this.svc.size()} puzzles.`);
    });

    on(d.sample500Btn, "click", () => {
      const n = this.svc.sample500();
      this.updatePackInfo();
      alert(`Pack size is now ${n}.`);
    });

    on(d.randomFromPackBtn, "click", () => this.startPlaylist());

    on(d.nextPuzzleBtn, "click", () => this.nextInPlaylist());
    on(d.hintBtn, "click", () => this.hint());
  }

  loadBuiltinRandom() {
    const p =
      BUILTIN_PUZZLES[Math.floor(Math.random() * BUILTIN_PUZZLES.length)];
    this.current = {
      id: p.id,
      themes: p.themes,
      fen: p.fen,
      solutionSan: p.solution.slice(),
    };
    this.index = 0;
    this.applyCurrent(true);
  }

  async startPlaylist() {
    if (!this.svc.size()) {
      alert("No local pack. Import or download first.");
      return;
    }
    const d = this.dom;
    const list = this.svc.playlistFromPack({
      theme: d.themeFilter?.value,
      opening: d.openingFilter?.value,
      min: parseInt(d.minRating?.value || "0", 10),
      max: parseInt(d.maxRating?.value || "4000", 10),
    });
    if (!list.length) {
      alert("No puzzles match your filter.");
      return;
    }
    this.playlist = list;
    this.playIndex = 0;
    try {
      await this.loadConvertedPuzzle(await adaptOrIdentity(this.playlist[0]));
    } catch (e) {
      alert("Failed to load puzzle: " + e.message);
    }
  }

  async nextInPlaylist() {
    if (!this.playlist.length) {
      this.loadBuiltinRandom();
      return;
    }
    this.playIndex = (this.playIndex + 1) % this.playlist.length;
    try {
      await this.loadConvertedPuzzle(
        await adaptOrIdentity(this.playlist[this.playIndex]),
      );
    } catch (e) {
      alert("Failed to load puzzle: " + e.message);
    }
  }

  async loadConvertedPuzzle(p) {
    try {
      const c = await adaptOrIdentity(p);
      this.current = c;
      this.index = 0;
      this.applyCurrent(true);
    } catch (e) {
      alert("Failed to convert puzzle: " + e.message);
    }
  }

  applyCurrent(center = false) {
    if (!this.current) return;
    // Ensure the side to move in puzzle FEN is loaded
    this.game.load?.(this.current.fen);
    // Clear any previous arrow
    this.ui.clearArrow?.();

    // show puzzle meta
    if (this.dom?.puzzleInfo) {
      const themeText = this.current.themes
        ? ` — <span class="muted">${this.current.themes}</span>`
        : "";
      this.dom.puzzleInfo.innerHTML = `<b>Puzzle</b> #${this.current.id || "local"}${themeText}`;
    }
    if (this.dom?.puzzleStatus) this.dom.puzzleStatus.textContent = "";

    this.onPuzzleLoad(this.game.turn?.());
    this.onStateChanged();
    if (center && this.ui?.resizeOverlay) this.ui.resizeOverlay();
  }

  // Called by App when user makes a move in puzzle mode
  handleUserMove(mv) {
    const sanNeeded = this.current?.solutionSan?.[this.index];
    if (!sanNeeded) return false;

    // Compare user move with expected SAN
    const userSan = mv?.san;
    if (userSan === sanNeeded) {
      // Good move
      this.index++;
      if (this.dom?.puzzleStatus)
        this.dom.puzzleStatus.innerHTML = `<span style="color:#39d98a">Correct!</span>`;
      if (this.index >= (this.current?.solutionSan?.length || 0)) {
        if (this.dom?.puzzleStatus)
          this.dom.puzzleStatus.innerHTML = `<span style="color:#39d98a">Solved 🎉</span>`;
        return true;
      } else {
        // Auto play the opponent reply (next SAN)
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
          // If reply cannot be played, just wait for next user move
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
    if (m) this.ui.drawArrowUci?.(m.from + m.to + (m.promotion || ""));
  }
}

// Prefer native lichess format, else pass-through
export async function adaptOrIdentity(p) {
  if (!p) throw new Error("No puzzle data");

  // Prefer native lichess format and let the adapter report issues
  if (p.puzzle || p.id || p.PuzzleId) {
    return adaptLichessPuzzle(p);
  }

  // fallback: expect { id, fen, solution: [SAN...] }
  if (!p.fen) throw new Error("Puzzle missing FEN");
  return {
    id: p.id || "local",
    fen: p.fen,
    themes: p.themes || p.thema || "",
    solutionSan: (p.solution || []).slice(),
  };
}

// Tiny demo pack to prime the UI if users don’t provide one
const DEMO_PACK = [
  {
    id: "demo-1",
    fen: "r2q1rk1/pp1b1ppp/2n1pn2/2bp4/3P4/2PBPN2/PP3PPP/R1BQ1RK1 w - - 0 1",
    themes: "QGD",
    solution: ["dxc5", "e5", "e4"],
  },
  {
    id: "demo-2",
    fen: "rnbqk2r/pppp1ppp/5n2/4p3/1bP5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq - 2 4",
    themes: "Sicilian/Caro",
    solution: ["Nxe5", "O-O", "g3"],
  },
  {
    id: "demo-3",
    fen: "r2q1rk1/pp2bppp/2n1pn2/2bp4/3P4/2P1PN2/PP1N1PPP/R1BQ1RK1 w - - 0 1",
    themes: "QGD",
    solution: ["dxc5", "e5", "e4"],
  },
];

// A few built-in puzzles if there’s nothing else around
const BUILTIN_PUZZLES = [
  {
    id: "b1",
    themes: "Mate in 1",
    fen: "6k1/5ppp/8/8/8/8/5PPP/6KQ w - - 0 1",
    solution: ["Qa8#"],
  },
  {
    id: "b2",
    themes: "Fork",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3",
    solution: ["d5", "Nd4"],
  },
  {
    id: "b3",
    themes: "Skewer",
    fen: "3r2k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1",
    solution: ["Rxd8#"],
  },
];
