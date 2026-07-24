"""THE FORGE dev server — static files with caching disabled (run: python serve.py)."""
import http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print("THE FORGE at http://127.0.0.1:8137")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8137), Handler).serve_forever()
