# Guidance for Automated Agents

This repository hosts the **chess-by-z** chess website. Gameplay runs in the browser while puzzle data comes from a Cloudflare D1 database via a worker.
Follow these guidelines when modifying the project.
Refer to `system-map.md` for a high-level overview of how key files depend on one another.

## Repository layout

- Application code lives in `chess-website-uml/public/src/`.
- Tests are in the `tests/` directory and use Node's built-in test runner.
- Third-party or generated assets reside in `chess-website-uml/public/src/vendor/` and are generally off-limits.
  - ESLint also ignores `chess-website-uml/public/src/engine/OpeningBook.js` and `chess-website-uml/public/src/engine/openingBookData.js`.

## Coding conventions

- Use modern ES modules (ECMAScript 2022).
- Format code with Prettier (`npx prettier --write <files>`).
  - Project Prettier settings enforce double quotes and semicolons.
- Lint with ESLint (`npm run lint`).
- Prefer small, focused commits with clear messages.

## Testing

Before committing or opening a pull request:

1. `npx prettier --write <changed files>`
2. `npm run lint`
3. `npm test`

Include the test and lint results in any pull request summary.
