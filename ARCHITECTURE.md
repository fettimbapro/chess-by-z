# Architecture

The project is a static client-side application. The key components are:

- **App layer (`src/app`)**: bootstraps the application and wires together UI and engine logic.
- **UI layer (`src/ui`)**: renders the chess board, handles user interaction, and updates the DOM.
- **Engine & utilities (`src/vendor`)**: third-party libraries such as `chess.mjs` provide core chess logic.

The application is served by a lightweight Python script that adds the required security headers for cross-origin isolation.

```
chess-website-uml/public
├── serve.py          # local development server
└── src
    ├── app           # application controllers
    ├── ui            # rendering and interaction
    └── vendor        # bundled third-party code
```

Future refactoring aims to further separate concerns and make each module independently testable.
