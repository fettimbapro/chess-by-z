# chess-by-z

An open-source chess website hosted on GitHub Pages. Gameplay runs in the browser while puzzle data is served by a Cloudflare Worker backed by a D1 database. The project showcases a pure HTML, CSS, and JavaScript approach and serves as an experiment with code generated via ChatGPT.

## Overview

- **Hosted via GitHub Pages** with puzzles queried through a Cloudflare Worker and D1 database.
- **Browser-based**: the chess engine and UI run entirely in the user's browser.
- **Educational**: aimed at experimenting with AI-assisted development and modern browser capabilities.

## Hosting

The static site is published at <https://fettimbapro.github.io/chess-by-z/>. Puzzle requests are proxied through a Cloudflare Worker that queries a D1 database (see [cloudflare/lichess-puzzle-db/worker.js](cloudflare/lichess-puzzle-db/worker.js)). To use your own backend, deploy a worker and set `window.PUZZLE_D1_URL` to its endpoint.

## Architecture

Source code lives in the top-level `src/` directory (symlinked from
`chess-website-uml/public/src` for the GitHub Pages build) and is organized
into:

- `app/` – application bootstrap and high-level controllers
- `core/` – game state wrapper and chess clock
- `engine/` – browser chess engine, evaluation helpers, and opening detection
- `puzzles/` – puzzle fetching, filtering, and UI helpers
- `ui/` – DOM rendering and user interaction helpers
- `util/` – shared utilities
- `workers/` – web worker entry points for engine variants
- `vendor/` – third-party libraries bundled with the project

See [ARCHITECTURE.md](ARCHITECTURE.md) and [system-map.md](system-map.md) for
deeper dives into these modules.

## Development

Install dependencies and start the local development server, which applies the
necessary cross-origin isolation headers:

```bash
npm install
npm run dev
```

This hosts the site at `http://127.0.0.1:8080/`.

### Piece font

For consistent chess piece rendering across platforms, download the [DejaVu Sans](https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf) font and place it at `css/fonts/DejaVuSans.ttf`.

### Engine variants

By default the site runs the original lightweight engine. For a stronger engine with enhanced evaluation you can append `?engine=strong` to the URL (e.g. `http://127.0.0.1:8080/?engine=strong`). This makes it easy to A/B test the classic and strong engines.

## Testing & Linting

Use ESLint for code style checks and Node's built-in test runner for unit
tests.

```bash
npm run lint
npm test
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started and the project's coding standards.

## License

This project is licensed under the [MIT License](LICENSE).
