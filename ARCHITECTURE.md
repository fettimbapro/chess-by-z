# Architecture

The project is a static site whose UI and engine run in the browser while puzzle data is retrieved from a Cloudflare Worker backed by a D1 database. The key components are:

- **App layer (`src/app`)**: bootstraps the application and wires together UI and engine logic.
- **UI layer (`src/ui`)**: renders the chess board, handles user interaction, and updates the DOM.
- **Engine & utilities (`src/vendor`)**: third-party libraries such as `chess.mjs` provide core chess logic.

For local development a lightweight Python script adds the required security headers for cross-origin isolation. In production the static assets are hosted on GitHub Pages and puzzle queries are proxied through the Cloudflare Worker.

```
chess-website-uml/public
├── serve.py          # local development server
└── src
    ├── app           # application controllers
    ├── ui            # rendering and interaction
    └── vendor        # bundled third-party code
```

Future refactoring aims to further separate concerns and make each module independently testable.
