"""ONEHAND OS — one server for the shell and every app (run: python serve.py)."""
import http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print("ONEHAND OS at http://127.0.0.1:8100")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8100), Handler).serve_forever()
