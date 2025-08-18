from http.server import HTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Cross-origin isolation headers
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # Helpful extra: keep resources same-origin only
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

HTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
