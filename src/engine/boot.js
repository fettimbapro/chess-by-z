// boot.js
// Late-bound bootstrap so we don't have to change your existing App.js.
// Wires EngineTuner + OpeningBook to the current DOM and engine.

import { EngineAdapter } from "./Adapter.js";
import { EngineTuner } from "./EngineTuner.js";
import { getBookMove } from "./OpeningBook.js";
import "./runMatches.js";

const $ = (id) => document.getElementById(id);

function collectDom() {
  return {
    // controls
    mode: $("mode"),
    auto: $("autoTune"),
    elo: $("elo"),
    eloVal: $("eloVal"),
    depth: $("depth"),
    depthVal: $("depthVal"),
    multipv: $("multipv"),
    multipvVal: $("multipvVal"),
    // badges
    threadsBadge: $("threadsBadge"),
    hashBadge: $("hashBadge"),
    // misc
    useBook: $("useBook"),
  };
}

function initBook(dom) {
  let bookEnabled = !!dom.useBook?.checked;
  dom.useBook?.addEventListener("change", () => {
    bookEnabled = !!dom.useBook.checked;
  });

  // Listen to book requests coming from your App (if it emits them)
  window.addEventListener("book-request", async (ev) => {
    const { sanHistory = "", ply = 0, mode = "play" } = ev.detail || {};
    const san = await getBookMove({
      sanHistory,
      ply,
      mode,
      enabled: bookEnabled,
    });
    if (san)
      window.dispatchEvent(new CustomEvent("book-move", { detail: { san } }));
  });
}

window.addEventListener("load", () => {
  // Find an engine instance if available
  const adapter = new EngineAdapter(window.app?.engine || window.engine);
  const dom = collectDom();

  // Initialize tuner (handles badges, listeners, initial retune, warmup)
  const tuner = new EngineTuner({ adapter, dom });
  tuner.init();

  // Hook tiny book
  initBook(dom);

  // Expose for debugging/custom integrations
  window.engineTuner = tuner;
});
