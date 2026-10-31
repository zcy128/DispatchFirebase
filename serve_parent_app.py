import http.server
import socketserver
import os
import sys

PORT = 5000
DIRECTORY = os.path.join(os.path.dirname(__file__), "parent_app", "build", "web")

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        # Strip query string or hash for file lookup
        clean_path = path.split('?')[0].split('#')[0]
        if clean_path in ("/parent", "/parent/"):
            clean_path = "/index.html"
        elif clean_path.startswith("/parent/"):
            clean_path = "/" + clean_path[len("/parent/"):]
        return super().translate_path(clean_path)

    def do_GET(self):
        # Redirect root / to /parent/ so base href="/parent/" matches browser location
        clean = self.path.split('?')[0].split('#')[0]
        if clean in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/parent/")
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        # Force browser to never cache any files in development/testing
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"[PARENT-APP-SERVER] Serving {DIRECTORY} on port {PORT} with zero-cache headers...")
        sys.stdout.flush()
        httpd.serve_forever()
