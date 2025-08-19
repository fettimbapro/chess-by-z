# System Map

This document outlines how the major files of the chess-by-z project depend on one another.

## App

- **app/App.js** – top-level orchestrator that wires the game together.
  - Imports core game logic (`core/Game.js`), clock (`core/Clock.js`), UI layer (`ui/BoardUI.js`, `ui/ClockPanel.js`), engine (`engine/WorkerEngine.js` and opening detection), puzzle components (`puzzles/PuzzleService.js`, `puzzles/PuzzleUI.js`), and utility sounds (`util/Sounds.js`).

## Core

- **core/Game.js** – wraps the third-party `vendor/chess.mjs` library to provide convenient game helpers.
- **core/Clock.js** – chess clock implementation; formats time via `util/format.js`.

## Engine

- **engine/WorkerEngine.js** – interface used by the app; delegates to `engine/Engine.js` and uses time estimation helpers from `engine/TimeManager.js`.
- **engine/TimeManager.js** – uses `vendor/chess.mjs` for position complexity estimates.
- **engine/EngineTuner.js** – adjusts engine parameters and relies on `engine/RuntimeCaps.js`.
- **engine/boot.js** – bootstraps the engine using `engine/Adapter.js`, `engine/EngineTuner.js`, and `engine/OpeningBook.js`.
- **engine/OpeningBook.js** – reads opening move data from `engine/openingBookData.js`.

## Puzzles

- **puzzles/PuzzleService.js** – fetches puzzles from external sources; no internal imports.
- **puzzles/PuzzleUI.js** – puzzle interaction layer built on `vendor/chess.mjs` and model helpers from `puzzles/PuzzleModel.js`.
- **puzzles/PuzzleModel.js** – adapts puzzle data and depends on `vendor/chess.mjs`.

## UI

- **ui/BoardUI.js** – DOM-based board rendering and interaction. Self-contained with no imports.
- **ui/ClockPanel.js** – connects a `core/Clock` instance to DOM controls.
- **ui/DrawOverlay.js**, **ui/MoveFlash.js**, **ui/SysArrowPolicy.js** – visual helpers with no module imports.

## Util

- **util/format.js** – basic formatting utilities used by the clock and evaluation bar.
- **util/Sounds.js** – small Web Audio utility for move and celebration sounds.
- **util/Events.js** – lightweight publish/subscribe event bus.
- **util/ErrorHandler.js** – forwards errors to a worker if available.

## Workers

- **workers/mini-engine.js** and **workers/strong-engine.js** – web worker entry points for classic and strong engines; both depend on `vendor/chess.mjs`.

## Vendor

- **vendor/** – third-party libraries such as `chess.mjs` and engine data; referenced by game logic and engine components but not modified.
