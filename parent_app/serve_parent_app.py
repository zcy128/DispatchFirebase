import http.server
import socketserver
import os
import sys

PORT = 5000
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "web")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

Handler.extensions_map.update({
    ".wasm": "application/wasm",
    ".js": "application/javascript",
    ".json": "application/json",
})

if __name__ == "__main__":
    print(f"Serving Parent App from {DIRECTORY} on port {PORT}...")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Parent App running at http://localhost:{PORT}")
        sys.stdout.flush()
        httpd.serve_forever()
