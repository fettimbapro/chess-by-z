# chess-by-z

Fun coding project for an open-source chess website where the processing is
fully client-side and without any external dependencies, coded in HTML, CSS
and JavaScript. This is mainly a project testing the functionality and playing
with the new "gpt-5 thinking" model; all code is written by ChatGPT using a
Plus subscription.

## Running locally

The client-side code expects certain cross-origin isolation headers. A small
Python 3 server is bundled to provide these headers. To start the server:

```bash
cd chess-website-uml/public
python serve.py
```

This will serve the site at `http://127.0.0.1:8080/`.

## Bundled dependencies

The repository includes vendor scripts such as
[`chess.mjs`](chess-website-uml/public/src/vendor/chess.mjs) for chess
logic.
