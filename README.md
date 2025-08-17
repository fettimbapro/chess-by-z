# chess-by-z

An open-source chess website where all processing happens client-side with no external dependencies. The project showcases a pure HTML, CSS, and JavaScript approach and serves as an experiment with code generated via ChatGPT.

## Overview
- **Fully client-side**: no backend server required.
- **Vendor-free**: aside from bundled libraries such as [chess.mjs](chess-website-uml/public/src/vendor/chess.mjs).
- **Educational**: aimed at experimenting with AI-assisted development and modern browser capabilities.

## Architecture
Source code lives under `chess-website-uml/public` and is organized into:
- `src/app` – application bootstrap and high-level controllers
- `src/ui` – DOM rendering and user interaction helpers
- `src/vendor` – third-party libraries bundled with the project

See [ARCHITECTURE.md](ARCHITECTURE.md) for a deeper dive.

## Development
The client-side code requires specific cross-origin isolation headers. A small Python server is provided to serve the site with the required headers.

```bash
npm run dev
```

This hosts the site at `http://127.0.0.1:8080/`.

### Engine variants

By default the site runs the original lightweight engine. For a stronger engine with enhanced evaluation you can append `?engine=strong` to the URL (e.g. `http://127.0.0.1:8080/?engine=strong`). This makes it easy to A/B test the classic and strong engines.

## Testing
Unit tests are written with the built-in Node.js test runner.

```bash
npm test
```

## Contributing
Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started and the project's coding standards.

## License
This project is licensed under the [MIT License](LICENSE).
