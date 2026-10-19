import http.server
import socketserver
import os
import sys

PORT = 5000
DIRECTORY = os.path.join(os.path.dirname(__file__), "parent_app", "build", "web")

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

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
