import test from "node:test";
import assert from "node:assert/strict";

// minimal DOM stubs for importing App
globalThis.window = { addEventListener() {} };
globalThis.document = {
  querySelector() {
    return null;
  },
  getElementById() {
    return null;
  },
  createElement() {
    return {
      setAttribute() {},
      appendChild() {},
      style: {},
      textContent: "",
      id: "",
    };
  },
  head: { appendChild() {} },
};

const { App } = await import("../chess-website-uml/public/src/app/App.js");

test("celebrates when puzzle solved without mate", () => {
  const app = Object.create(App.prototype);
  app.inReview = false;
  app.lastCelebrationPly = -1;
  app.getSanHistory = () => ["e4"];
  app.isMateNow = () => false;
  app.modeSel = { value: "puzzle" };
  app.puzzles = { current: { solutionSan: ["e4"] }, index: 1 };
  app.sounds = {
    played: null,
    play(n) {
      this.played = n;
    },
  };
  app.ui = {
    celebrated: false,
    square: undefined,
    celebrate(sq) {
      this.celebrated = true;
      this.square = sq;
    },
  };

  App.prototype.maybeCelebrate.call(app);

  assert.equal(app.sounds.played, "airhorn");
  assert.equal(app.ui.celebrated, true);
  assert.equal(app.ui.square, undefined);
  assert.equal(app.lastCelebrationPly, 1);
});

test("resets celebration state when puzzle loads", () => {
  const app = Object.create(App.prototype);
  app.sideSel = { value: "white" };
  app.gameOver = true;
  app.applyOrientation = () => {
    app.oriented = true;
  };
  app.updateSwitchButtonText = () => {
    app.switchTextUpdated = true;
  };
  app.ui = {
    stopped: false,
    stopCelebration() {
      this.stopped = true;
    },
  };
  app.lastCelebrationPly = 3;

  App.prototype.handlePuzzleLoad.call(app, "b");

  assert.equal(app.sideSel.value, "black");
  assert.equal(app.gameOver, false);
  assert.equal(app.lastCelebrationPly, -1);
  assert.equal(app.ui.stopped, true);
  assert.equal(app.oriented, true);
  assert.equal(app.switchTextUpdated, true);
});
