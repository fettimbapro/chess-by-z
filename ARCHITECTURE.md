# Architecture

The project is a static site whose UI and engine run entirely in the browser.
Puzzle data is retrieved from a Cloudflare Worker backed by a D1 database.

Source code resides in the top-level `src/` directory (symlinked as
`chess-website-uml/public/src` for the GitHub Pages build). Major areas include:

- **app/** – bootstraps the application and wires together UI, engine, and
  puzzle logic.
- **core/** – game state wrapper and chess clock.
- **engine/** – browser chess engine, evaluation helpers, and opening
  detection.
- **puzzles/** – puzzle fetching, filtering, and presentation.
- **ui/** – DOM rendering and user interaction.
- **util/** – shared utilities.
- **workers/** – web worker entry points for the classic and strong engines.
- **vendor/** – bundled third-party code like `chess.mjs`.

Supporting directories:

- **cloudflare/** – Cloudflare Workers for the puzzle API and logging.
- **lib/** – static data such as the puzzle opening index.

For local development a lightweight Python script (`serve.py`) adds the
required security headers for cross-origin isolation. In production the static
assets are hosted on GitHub Pages and puzzle queries are proxied through the
Cloudflare Worker.

```
src
├── app            # application controllers
├── core           # game logic & clock
├── engine         # engine and adapters
├── puzzles        # puzzle fetching & UI
├── ui             # rendering and interaction
├── util           # shared utilities
├── workers        # web worker entry points
└── vendor         # bundled third-party code
```

Future refactoring aims to further separate concerns and make each module
independently testable.
