"""RSG — one server for the whole portfolio (run: python serve.py).

Serves this folder on http://127.0.0.1:8100 with the Onehand OS shell at /.
Apps are served from their original folders (GHOST, The forge, ...) — the
shell references them via Onehand OS/apps.json; nothing is copied.
"""
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/Onehand%20OS/")
            self.end_headers()
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == "__main__":
    print("RSG / ONEHAND OS at http://127.0.0.1:8100")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8100), Handler).serve_forever()
