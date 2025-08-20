from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import csv
import json
import random


BASE_DIR = Path(__file__).resolve().parent
PUZZLE_DIR = BASE_DIR / "lib" / "lichess_puzzle_db" / "rating_sort"
# Precompute rating range for each CSV file to avoid scanning all files
PUZZLE_FILES = []
for f in sorted(PUZZLE_DIR.glob("lichess_db_puzzle_sorted.*.csv")):
    # Determine min rating from first puzzle
    with f.open() as fh:
        reader = csv.DictReader(fh)
        try:
            first = next(reader)
            min_rating = int(first["Rating"]) if first["Rating"] else 0
        except StopIteration:
            continue
    # Determine max rating from last puzzle without loading entire file
    with f.open("rb") as fh:
        fh.seek(0, 2)
        size = fh.tell()
        block = 1024
        while True:
            if block >= size:
                fh.seek(0)
                data = fh.read().decode()
                break
            fh.seek(-block, 2)
            data = fh.read().decode()
            if data.count("\n") > 1:
                break
            block *= 2
        last_line = data.strip().split("\n")[-1]
    last_row = next(csv.DictReader([last_line], fieldnames=[
        "PuzzleId",
        "FEN",
        "Moves",
        "Rating",
        "RatingDeviation",
        "Popularity",
        "NbPlays",
        "Themes",
        "GameUrl",
        "OpeningTags",
    ]))
    max_rating = int(last_row["Rating"]) if last_row["Rating"] else min_rating
    PUZZLE_FILES.append((min_rating, max_rating, f))


def select_puzzle(params, count_only=False):
    rating_min = int(params.get("ratingMin", [0])[0])
    rating_max = int(params.get("ratingMax", [3500])[0])
    opening = params.get("opening", [""])[0]
    themes = params.get("theme", [])
    exclude = set(params.get("exclude", []))

    total = 0
    chosen = None

    for min_r, max_r, file in PUZZLE_FILES:
        if max_r < rating_min or min_r > rating_max:
            continue
        with file.open() as f:
            reader = csv.DictReader(f)
            for row in reader:
                rating = int(row["Rating"]) if row["Rating"] else 0
                if rating < rating_min or rating > rating_max:
                    continue
                if opening and opening not in (row.get("OpeningTags") or ""):
                    continue
                if any(t not in (row.get("Themes") or "") for t in themes):
                    continue
                if row["PuzzleId"] in exclude:
                    continue
                total += 1
                if count_only:
                    continue
                if random.randrange(total) == 0:
                    chosen = {
                        "id": row["PuzzleId"],
                        "fen": row["FEN"],
                        "moves": row["Moves"],
                        "rating": rating,
                        "ratingDeviation": int(row["RatingDeviation"] or 0),
                        "popularity": int(row["Popularity"] or 0),
                        "nbPlays": int(row["NbPlays"] or 0),
                        "themes": row.get("Themes") or "",
                        "gameUrl": row.get("GameUrl") or "",
                        "openingTags": row.get("OpeningTags") or "",
                    }

    return {"count": total} if count_only else chosen


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Cross-origin isolation headers
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # Helpful extra: keep resources same-origin only
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/puzzle":
            params = parse_qs(parsed.query)
            count_only = params.get("count") is not None
            puzzle = select_puzzle(params, count_only=count_only)
            self.send_response(200 if puzzle else 404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if puzzle:
                self.wfile.write(json.dumps(puzzle).encode("utf-8"))
            else:
                self.wfile.write(json.dumps({"error": "No puzzle"}).encode("utf-8"))
        else:
            super().do_GET()


HTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
